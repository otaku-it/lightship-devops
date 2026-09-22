from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Environment(TimestampMixin, Base):
    __tablename__ = "environments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    slug: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    approval_required: Mapped[bool] = mapped_column(default=False)
    release_window: Mapped[str] = mapped_column(String(64), default="全天开放")

    targets = relationship("DeploymentTarget", back_populates="environment")
    releases = relationship("Release", back_populates="environment")


class DeploymentTarget(TimestampMixin, Base):
    __tablename__ = "deployment_targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    environment_id: Mapped[int] = mapped_column(ForeignKey("environments.id"))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    connection_type: Mapped[str] = mapped_column(String(32))
    address: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(default=22)
    username: Mapped[str] = mapped_column(String(64), default="deploy")
    credential_ref: Mapped[str] = mapped_column(String(255), default="")
    deploy_path: Mapped[str] = mapped_column(
        String(500), default="/opt/apps/{project}/releases/{version}"
    )
    start_command: Mapped[str] = mapped_column(String(500), default="")
    health_check_command: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(32), default="unknown")
    system_info: Mapped[str] = mapped_column(Text, default="")

    environment = relationship("Environment", back_populates="targets")
    project = relationship("Project", back_populates="targets")
    access = relationship(
        "TargetAccess", back_populates="target", uselist=False, cascade="all, delete-orphan"
    )


class TargetAccess(Base):
    __tablename__ = "target_access"

    id: Mapped[int] = mapped_column(primary_key=True)
    target_id: Mapped[int] = mapped_column(
        ForeignKey("deployment_targets.id"), unique=True, index=True
    )
    auth_type: Mapped[str] = mapped_column(String(32), default="password")
    password_encrypted: Mapped[str] = mapped_column(Text, default="")
    private_key_encrypted: Mapped[str] = mapped_column(Text, default="")
    passphrase_encrypted: Mapped[str] = mapped_column(Text, default="")
    host_key_fingerprint: Mapped[str] = mapped_column(String(128), default="")
    trust_on_first_use: Mapped[bool] = mapped_column(default=True)
    service_port: Mapped[int] = mapped_column(default=8080)

    target = relationship("DeploymentTarget", back_populates="access")
