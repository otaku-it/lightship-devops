from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, require_operator, require_release_manager
from app.core.config import settings
from app.core.database import get_db
from app.models.environment import DeploymentTarget, Environment, TargetAccess
from app.models.project import Project
from app.models.release import Release, ReleaseStep
from app.models.user import User
from app.schemas.release import ReleaseCreate, ReleaseRead
from app.services.release_runner import run_release
from app.services.audit import record_audit

router = APIRouter(prefix="/releases", tags=["发布"])


def release_read(release: Release) -> ReleaseRead:
    return ReleaseRead(
        **{column.name: getattr(release, column.name) for column in Release.__table__.columns if column.name not in {"artifact_url", "updated_at"}},
        project_name=release.project.name if release.project else "",
        project_type=release.project.project_type if release.project else "",
        environment_name=release.environment.name if release.environment else "",
        steps=sorted(release.steps, key=lambda item: item.sequence),
        logs=sorted(release.logs, key=lambda item: item.id),
        deployments=sorted(release.deployments, key=lambda item: item.id),
    )


def release_query():
    return select(Release).options(
        selectinload(Release.project),
        selectinload(Release.environment),
        selectinload(Release.steps),
        selectinload(Release.logs),
        selectinload(Release.deployments),
    )


@router.get("", response_model=list[ReleaseRead])
def list_releases(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[ReleaseRead]:
    items = db.scalars(release_query().order_by(Release.id.desc())).unique().all()
    return [release_read(item) for item in items]


@router.post("", response_model=ReleaseRead, status_code=201)
def create_release(
    payload: ReleaseCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
) -> ReleaseRead:
    project = db.get(Project, payload.project_id)
    environment = db.get(Environment, payload.environment_id)
    if not project or not environment:
        raise HTTPException(status_code=404, detail="项目或环境不存在")
    if payload.strategy != "rolling":
        raise HTTPException(status_code=422, detail="当前真实执行仅支持逐台发布策略")
    target_count = db.scalar(
        select(func.count()).select_from(DeploymentTarget).where(
            DeploymentTarget.project_id == project.id,
            DeploymentTarget.environment_id == environment.id,
        )
    ) or 0
    if not target_count:
        raise HTTPException(
            status_code=422,
            detail="该项目在所选环境中没有目标服务器，请先完成项目、环境与服务器绑定",
        )
    if settings.executor_mode != "mock":
        ready_count = db.scalar(
            select(func.count())
            .select_from(DeploymentTarget)
            .join(TargetAccess, TargetAccess.target_id == DeploymentTarget.id)
            .where(
                DeploymentTarget.project_id == project.id,
                DeploymentTarget.environment_id == environment.id,
                DeploymentTarget.connection_type == "ssh",
                DeploymentTarget.status == "online",
                or_(
                    TargetAccess.password_encrypted != "",
                    TargetAccess.private_key_encrypted != "",
                ),
            )
        ) or 0
        if not ready_count:
            raise HTTPException(
                status_code=422,
                detail="所选环境没有连接正常且已配置凭证的 SSH 服务器",
            )
    next_id = (db.scalar(select(func.max(Release.id))) or 0) + 1
    release = Release(
        release_no=f"REL-{1000 + next_id}",
        created_by=user.display_name,
        **payload.model_dump(),
    )
    db.add(release)
    db.flush()
    step_names = (
        ["拉取代码", "校验 Docker 配置", "打包构建上下文", "构建镜像并更新容器"]
        if project.deployment_mode == "docker"
        else ["拉取代码", "校验 Compose 配置", "打包 Compose 上下文", "更新 Compose 服务"]
        if project.deployment_mode == "compose"
        else ["拉取代码", "构建与测试", "生成制品", "部署并验证"]
    )
    for sequence, name in enumerate(step_names, start=1):
        db.add(ReleaseStep(release_id=release.id, sequence=sequence, name=name))
    record_audit(
        db,
        user,
        action="release.create",
        resource_type="release",
        resource_id=release.id,
        summary=f"发起发布 {release.release_no}",
        detail={"project": project.name, "environment": environment.name, "branch": release.branch, "version": release.version},
    )
    db.commit()
    item = db.scalars(release_query().where(Release.id == release.id)).unique().one()
    background_tasks.add_task(run_release, release.id)
    return release_read(item)


@router.get("/{release_id}", response_model=ReleaseRead)
def get_release(
    release_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ReleaseRead:
    item = db.scalars(release_query().where(Release.id == release_id)).unique().first()
    if not item:
        raise HTTPException(status_code=404, detail="发布单不存在")
    return release_read(item)


@router.delete("/{release_id}", status_code=204)
def delete_release(
    release_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_release_manager),
) -> Response:
    release = db.get(Release, release_id)
    if not release:
        raise HTTPException(status_code=404, detail="发布单不存在")
    if release.status in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="发布正在执行，不能删除")
    release_no = release.release_no
    db.delete(release)
    record_audit(
        db,
        actor,
        action="release.delete",
        resource_type="release",
        resource_id=release_id,
        summary=f"删除发布记录 {release_no}",
    )
    db.commit()
    return Response(status_code=204)
