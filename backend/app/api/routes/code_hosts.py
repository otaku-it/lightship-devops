from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin
from app.core.database import get_db
from app.models.code_host import CodeHostConnection
from app.models.project import Project
from app.models.user import User
from app.schemas.code_host import (
    CodeHostConnectionCreate,
    CodeHostConnectionRead,
    CodeHostRepository,
    CodeHostTestResult,
)
from app.services.audit import record_audit
from app.services.code_hosts import can_view_connection, decode_visible_roles, encode_visible_roles, list_repositories, normalize_base_url, test_connection
from app.services.credentials import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/code-hosts", tags=["代码托管"])


def connection_read(item: CodeHostConnection, db: Session) -> CodeHostConnectionRead:
    project_count = db.scalar(
        select(func.count()).select_from(Project).where(Project.code_host_connection_id == item.id)
    ) or 0
    return CodeHostConnectionRead(
        id=item.id,
        name=item.name,
        provider=item.provider,
        base_url=item.base_url,
        username=item.username,
        token_configured=bool(item.token_encrypted),
        status=item.status,
        account_name=item.account_name,
        last_error=item.last_error,
        visible_roles=decode_visible_roles(item.visible_roles),
        last_tested_at=item.last_tested_at,
        created_at=item.created_at,
        project_count=project_count,
    )


@router.get("", response_model=list[CodeHostConnectionRead])
def get_connections(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[CodeHostConnectionRead]:
    return [
        connection_read(item, db)
        for item in db.scalars(select(CodeHostConnection).order_by(CodeHostConnection.id.desc()))
        if can_view_connection(item, user)
    ]


@router.post("", response_model=CodeHostConnectionRead, status_code=201)
def create_connection(
    payload: CodeHostConnectionCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> CodeHostConnectionRead:
    if db.scalar(select(CodeHostConnection).where(CodeHostConnection.name == payload.name.strip())):
        raise HTTPException(status_code=409, detail="连接名称已存在")
    try:
        base_url = normalize_base_url(payload.provider, payload.base_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    item = CodeHostConnection(
        name=payload.name.strip(),
        provider=payload.provider,
        base_url=base_url,
        username=payload.username.strip(),
        token_encrypted=encrypt_secret(payload.token),
        visible_roles=encode_visible_roles(payload.visible_roles),
    )
    db.add(item)
    db.flush()
    record_audit(db, actor, action="code_host.create", resource_type="code_host", resource_id=item.id, summary=f"创建代码托管连接 {item.name}", detail={"provider": item.provider, "base_url": item.base_url, "visible_roles": decode_visible_roles(item.visible_roles)})
    db.commit()
    db.refresh(item)
    return connection_read(item, db)


@router.put("/{connection_id}", response_model=CodeHostConnectionRead)
def update_connection(
    connection_id: int,
    payload: CodeHostConnectionCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> CodeHostConnectionRead:
    item = db.get(CodeHostConnection, connection_id)
    if not item:
        raise HTTPException(status_code=404, detail="代码托管连接不存在")
    duplicate = db.scalar(select(CodeHostConnection).where(CodeHostConnection.name == payload.name.strip(), CodeHostConnection.id != connection_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="连接名称已存在")
    try:
        base_url = normalize_base_url(payload.provider, payload.base_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    connection_changed = (
        item.provider != payload.provider
        or item.base_url != base_url
        or item.username != payload.username.strip()
        or bool(payload.token)
    )
    item.name = payload.name.strip()
    item.provider = payload.provider
    item.base_url = base_url
    item.username = payload.username.strip()
    if payload.token:
        item.token_encrypted = encrypt_secret(payload.token)
    item.visible_roles = encode_visible_roles(payload.visible_roles)
    if connection_changed:
        item.status = "untested"
        item.last_error = ""
    record_audit(db, actor, action="code_host.update", resource_type="code_host", resource_id=item.id, summary=f"更新代码托管连接 {item.name}", detail={"provider": item.provider, "base_url": item.base_url, "visible_roles": decode_visible_roles(item.visible_roles)})
    db.commit()
    db.refresh(item)
    return connection_read(item, db)


@router.post("/{connection_id}/test", response_model=CodeHostTestResult)
def test_code_host(
    connection_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> CodeHostTestResult:
    item = db.get(CodeHostConnection, connection_id)
    if not item:
        raise HTTPException(status_code=404, detail="代码托管连接不存在")
    try:
        result = test_connection(item.provider, item.base_url, decrypt_secret(item.token_encrypted))
        item.status = "connected"
        item.account_name = result.account_name
        item.last_error = ""
        if not item.username:
            item.username = result.username
        item.last_tested_at = datetime.utcnow()
        record_audit(db, actor, action="code_host.test", resource_type="code_host", resource_id=item.id, summary=f"测试代码托管连接 {item.name}", result="success")
        db.commit()
        return CodeHostTestResult(success=True, message=f"连接成功，当前账号：{result.account_name}", account_name=result.account_name)
    except (ValueError, RuntimeError) as exc:
        item.status = "failed"
        item.last_error = str(exc)[:500]
        item.last_tested_at = datetime.utcnow()
        record_audit(db, actor, action="code_host.test", resource_type="code_host", resource_id=item.id, summary=f"测试代码托管连接 {item.name}", detail=str(exc), result="failed")
        db.commit()
        return CodeHostTestResult(success=False, message=str(exc))


@router.get("/{connection_id}/repositories", response_model=list[CodeHostRepository])
def get_repositories(
    connection_id: int,
    search: str = Query(default="", max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CodeHostRepository]:
    item = db.get(CodeHostConnection, connection_id)
    if not item:
        raise HTTPException(status_code=404, detail="代码托管连接不存在")
    if not can_view_connection(item, user):
        raise HTTPException(status_code=403, detail="当前账号没有查看此代码托管连接的权限")
    if item.status != "connected":
        raise HTTPException(status_code=409, detail="请先由管理员完成连接测试，再读取仓库")
    try:
        rows = list_repositories(item.provider, item.base_url, decrypt_secret(item.token_encrypted), search)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return [CodeHostRepository.model_validate(row) for row in rows]


@router.delete("/{connection_id}", status_code=204)
def delete_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> Response:
    item = db.get(CodeHostConnection, connection_id)
    if not item:
        raise HTTPException(status_code=404, detail="代码托管连接不存在")
    project_count = db.scalar(select(func.count()).select_from(Project).where(Project.code_host_connection_id == item.id)) or 0
    if project_count:
        raise HTTPException(status_code=409, detail=f"仍有 {project_count} 个项目使用该连接，请先解除绑定")
    name = item.name
    db.delete(item)
    record_audit(db, actor, action="code_host.delete", resource_type="code_host", resource_id=connection_id, summary=f"删除代码托管连接 {name}")
    db.commit()
    return Response(status_code=204)
