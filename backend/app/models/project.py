from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    project_type: Mapped[str] = mapped_column(String(32))
    repository_url: Mapped[str] = mapped_column(String(500))
    default_branch: Mapped[str] = mapped_column(String(128), default="main")
    build_command: Mapped[str] = mapped_column(String(500), default="")
    artifact_pattern: Mapped[str] = mapped_column(String(255), default="")
    health_path: Mapped[str] = mapped_column(String(255), default="/health")
    deployment_mode: Mapped[str] = mapped_column(String(32), default="file")
    dockerfile_path: Mapped[str] = mapped_column(String(255), default="Dockerfile")
    docker_image_name: Mapped[str] = mapped_column(String(255), default="")
    docker_container_port: Mapped[int] = mapped_column(default=8080)
    docker_run_args: Mapped[str] = mapped_column(String(1000), default="")
    compose_file_path: Mapped[str] = mapped_column(String(255), default="docker-compose.yml")
    compose_project_name: Mapped[str] = mapped_column(String(100), default="")

    releases = relationship("Release", back_populates="project")
    targets = relationship("DeploymentTarget", back_populates="project")
    credential = relationship(
        "ProjectCredential", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )


class ProjectCredential(Base):
    __tablename__ = "project_credentials"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(255), default="")
    token_encrypted: Mapped[str] = mapped_column(Text, default="")

    project = relationship("Project", back_populates="credential")
