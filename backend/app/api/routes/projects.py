from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.environment import DeploymentTarget
from app.models.project import Project, ProjectCredential
from app.models.release import Release
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead
from app.services.credentials import encrypt_secret

router = APIRouter(prefix="/projects", tags=["项目"])


def validate_project(payload: ProjectCreate) -> None:
    if payload.deployment_mode not in {"file", "docker"}:
        raise HTTPException(status_code=422, detail="部署方式只支持 file 或 docker")
    if payload.deployment_mode == "docker":
        if not payload.dockerfile_path.strip():
            raise HTTPException(status_code=422, detail="Docker 部署必须配置 Dockerfile 路径")
        if payload.docker_container_port < 1 or payload.docker_container_port > 65535:
            raise HTTPException(status_code=422, detail="容器端口必须在 1-65535 之间")


def project_read(project: Project, db: Session) -> ProjectRead:
    total = db.scalar(select(func.count()).select_from(Release).where(Release.project_id == project.id)) or 0
    succeeded = db.scalar(select(func.count()).select_from(Release).where(Release.project_id == project.id, Release.status == "success")) or 0
    return ProjectRead(
        **{column.name: getattr(project, column.name) for column in Project.__table__.columns if column.name != "updated_at"},
        release_count=total,
        success_rate=round(succeeded / total * 100, 1) if total else 0,
        credential_configured=bool(project.credential and project.credential.token_encrypted),
        git_username=project.credential.username if project.credential else "",
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[ProjectRead]:
    return [project_read(item, db) for item in db.scalars(select(Project).order_by(Project.id))]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectRead:
    validate_project(payload)
    if db.scalar(select(Project).where(Project.name == payload.name)):
        raise HTTPException(status_code=409, detail="项目名称已存在")
    data = payload.model_dump(exclude={"git_username", "git_token"})
    project = Project(**data)
    db.add(project)
    db.flush()
    if payload.git_username or payload.git_token:
        db.add(
            ProjectCredential(
                project_id=project.id,
                username=payload.git_username,
                token_encrypted=encrypt_secret(payload.git_token),
            )
        )
    db.commit()
    db.refresh(project)
    return project_read(project, db)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectRead:
    validate_project(payload)
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    duplicate = db.scalar(
        select(Project).where(Project.name == payload.name, Project.id != project_id)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="项目名称已存在")
    deployment_mode_changed = project.deployment_mode != payload.deployment_mode
    for key, value in payload.model_dump(exclude={"git_username", "git_token"}).items():
        setattr(project, key, value)
    if deployment_mode_changed:
        for target in db.scalars(
            select(DeploymentTarget).where(DeploymentTarget.project_id == project.id)
        ):
            target.status = "unknown"
    credential = project.credential
    if payload.git_username or payload.git_token or credential:
        if not credential:
            credential = ProjectCredential(project_id=project.id)
            db.add(credential)
        credential.username = payload.git_username
        if payload.git_token:
            credential.token_encrypted = encrypt_secret(payload.git_token)
    db.commit()
    db.refresh(project)
    return project_read(project, db)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectRead:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project_read(project, db)
