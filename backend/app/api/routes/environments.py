from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_operator, require_release_manager
from app.core.database import get_db
from app.models.environment import DeploymentTarget, Environment, TargetAccess
from app.models.project import Project
from app.models.release import Release, ReleaseDeployment
from app.models.user import User
from app.schemas.environment import (
    ConnectionTestRequest,
    ConnectionTestResult,
    EnvironmentCreate,
    EnvironmentRead,
    TargetCreate,
    TargetRead,
    ServiceStatusRead,
    ServiceControlRead,
    ServiceControlRequest,
)
from app.services.executors.factory import get_executor
from app.services.credentials import decrypt_secret, encrypt_secret
from app.core.config import settings

router = APIRouter(tags=["环境"])


def target_read(target: DeploymentTarget) -> TargetRead:
    data = {column.name: getattr(target, column.name) for column in DeploymentTarget.__table__.columns if column.name != "updated_at"}
    access = target.access
    return TargetRead(
        **data,
        environment_name=target.environment.name if target.environment else "",
        project_name=target.project.name if target.project else "",
        auth_type=access.auth_type if access else "password",
        credential_configured=bool(
            access and (access.password_encrypted or access.private_key_encrypted)
        ),
        host_key_fingerprint=access.host_key_fingerprint if access else "",
        trust_on_first_use=access.trust_on_first_use if access else True,
        service_port=access.service_port if access else 8080,
    )


def save_access(target: DeploymentTarget, payload: TargetCreate, db: Session) -> None:
    access = target.access
    if not access:
        access = TargetAccess()
        target.access = access
    access.auth_type = payload.auth_type
    access.host_key_fingerprint = payload.host_key_fingerprint
    access.trust_on_first_use = payload.trust_on_first_use
    access.service_port = payload.service_port
    if payload.password:
        access.password_encrypted = encrypt_secret(payload.password)
    if payload.private_key:
        access.private_key_encrypted = encrypt_secret(payload.private_key)
    if payload.passphrase:
        access.passphrase_encrypted = encrypt_secret(payload.passphrase)
    target.credential_ref = f"managed:ssh/{target.id}"


@router.get("/environments", response_model=list[EnvironmentRead])
def list_environments(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[EnvironmentRead]:
    environments = list(db.scalars(select(Environment).order_by(Environment.id)))
    result = []
    for environment in environments:
        count = db.scalar(select(func.count()).select_from(DeploymentTarget).where(DeploymentTarget.environment_id == environment.id)) or 0
        result.append(EnvironmentRead(id=environment.id, name=environment.name, slug=environment.slug, approval_required=environment.approval_required, release_window=environment.release_window, target_count=count))
    return result


@router.post("/environments", response_model=EnvironmentRead, status_code=201)
def create_environment(
    payload: EnvironmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> EnvironmentRead:
    environment = Environment(**payload.model_dump())
    db.add(environment)
    db.commit()
    db.refresh(environment)
    return EnvironmentRead(**payload.model_dump(), id=environment.id, target_count=0)


@router.get("/targets", response_model=list[TargetRead])
def list_targets(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[TargetRead]:
    targets = list(db.scalars(select(DeploymentTarget).order_by(DeploymentTarget.id)))
    return [target_read(target) for target in targets]


@router.post("/targets", response_model=TargetRead, status_code=201)
def create_target(
    payload: TargetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> TargetRead:
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail="项目不存在")
    if not db.get(Environment, payload.environment_id):
        raise HTTPException(status_code=404, detail="环境不存在")
    data = payload.model_dump(
        exclude={
            "auth_type",
            "password",
            "private_key",
            "passphrase",
            "host_key_fingerprint",
            "trust_on_first_use",
            "service_port",
        }
    )
    target = DeploymentTarget(**data, status="unknown")
    db.add(target)
    db.flush()
    save_access(target, payload, db)
    db.commit()
    db.refresh(target)
    return target_read(target)


@router.put("/targets/{target_id}", response_model=TargetRead)
def update_target(
    target_id: int,
    payload: TargetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> TargetRead:
    target = db.get(DeploymentTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="部署目标不存在")
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail="项目不存在")
    duplicate = db.scalar(
        select(DeploymentTarget).where(
            DeploymentTarget.name == payload.name, DeploymentTarget.id != target_id
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="部署目标名称已存在")
    data = payload.model_dump(
        exclude={
            "auth_type",
            "password",
            "private_key",
            "passphrase",
            "host_key_fingerprint",
            "trust_on_first_use",
            "service_port",
        }
    )
    for key, value in data.items():
        setattr(target, key, value)
    target.status = "unknown"
    save_access(target, payload, db)
    db.commit()
    db.refresh(target)
    return target_read(target)


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(
    target_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> Response:
    target = db.get(DeploymentTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="部署目标不存在")
    release_count = db.scalar(
        select(func.count())
        .select_from(ReleaseDeployment)
        .where(ReleaseDeployment.target_id == target_id)
    ) or 0
    if release_count:
        raise HTTPException(
            status_code=409,
            detail=f"该服务器仍被 {release_count} 条发布结果引用，请先删除相关发布记录",
        )
    db.delete(target)
    db.commit()
    return Response(status_code=204)


@router.post("/targets/{target_id}/test", response_model=ConnectionTestResult)
def test_target(
    target_id: int,
    payload: ConnectionTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> ConnectionTestResult:
    target = db.get(DeploymentTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="部署目标不存在")
    access = target.access
    try:
        private_key = payload.private_key or decrypt_secret(
            access.private_key_encrypted if access else ""
        )
        password = payload.password or decrypt_secret(
            access.password_encrypted if access else ""
        )
        passphrase = payload.passphrase or decrypt_secret(
            access.passphrase_encrypted if access else ""
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        executor = get_executor(target.connection_type)
        result = executor.test_connection(
            target,
            private_key=private_key,
            password=password,
            passphrase=passphrase,
            expected_fingerprint=access.host_key_fingerprint if access else "",
            trust_on_first_use=access.trust_on_first_use if access else False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    target.status = "online" if result.success else "offline"
    if result.system_info:
        target.system_info = result.system_info
    if result.success and result.host_key_fingerprint and access:
        access.host_key_fingerprint = result.host_key_fingerprint
    db.commit()
    return ConnectionTestResult(**result.__dict__)


@router.post("/targets/{target_id}/service-status", response_model=ServiceStatusRead)
def check_service_status(
    target_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ServiceStatusRead:
    target = db.get(DeploymentTarget, target_id)
    if not target or not target.project:
        raise HTTPException(status_code=404, detail="部署目标或关联项目不存在")
    access = target.access
    if settings.executor_mode != "mock" and (not access or not (access.password_encrypted or access.private_key_encrypted)):
        raise HTTPException(status_code=422, detail="目标服务器尚未配置 SSH 凭证")
    latest = db.execute(
        select(Release, ReleaseDeployment)
        .join(ReleaseDeployment, ReleaseDeployment.release_id == Release.id)
        .where(
            ReleaseDeployment.target_id == target.id,
            ReleaseDeployment.status == "success",
            Release.status == "success",
        )
        .order_by(Release.finished_at.desc(), Release.id.desc())
        .limit(1)
    ).first()
    release, deployment = latest if latest else (None, None)
    try:
        executor = get_executor(target.connection_type)
        result = executor.check_service_status(
            target,
            project_name=target.project.name,
            deployment_mode=target.project.deployment_mode,
            version=release.version if release else "",
            release_no=release.release_no if release else "",
            deployed_path=deployment.deployed_path if deployment else "",
            docker_container_port=target.project.docker_container_port,
            compose_project_name=target.project.compose_project_name,
            private_key=decrypt_secret(access.private_key_encrypted if access else ""),
            password=decrypt_secret(access.password_encrypted if access else ""),
            passphrase=decrypt_secret(access.passphrase_encrypted if access else ""),
            expected_fingerprint=access.host_key_fingerprint if access else "",
            trust_on_first_use=access.trust_on_first_use if access else False,
            service_port=access.service_port if access else 8080,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ServiceStatusRead(
        target_id=target.id,
        project_id=target.project.id,
        **result.__dict__,
    )


@router.post("/targets/{target_id}/service-control", response_model=ServiceControlRead)
def control_service(
    target_id: int,
    payload: ServiceControlRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> ServiceControlRead:
    if payload.action not in {"stop", "start", "restart"}:
        raise HTTPException(status_code=422, detail="服务操作只支持 stop、start 或 restart")
    target = db.get(DeploymentTarget, target_id)
    if not target or not target.project:
        raise HTTPException(status_code=404, detail="部署目标或关联项目不存在")
    access = target.access
    if settings.executor_mode != "mock" and (not access or not (access.password_encrypted or access.private_key_encrypted)):
        raise HTTPException(status_code=422, detail="目标服务器尚未配置 SSH 凭证")
    try:
        executor = get_executor(target.connection_type)
        result = executor.control_service(
            target,
            action=payload.action,
            project_name=target.project.name,
            deployment_mode=target.project.deployment_mode,
            stop_command=target.stop_command,
            start_command=target.start_command,
            compose_file_path=target.project.compose_file_path,
            compose_project_name=target.project.compose_project_name,
            private_key=decrypt_secret(access.private_key_encrypted if access else ""),
            password=decrypt_secret(access.password_encrypted if access else ""),
            passphrase=decrypt_secret(access.passphrase_encrypted if access else ""),
            expected_fingerprint=access.host_key_fingerprint if access else "",
            trust_on_first_use=access.trust_on_first_use if access else False,
            service_port=access.service_port if access else 8080,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ServiceControlRead(target_id=target.id, action=payload.action, **result.__dict__)
