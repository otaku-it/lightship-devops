from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Release(TimestampMixin, Base):
    __tablename__ = "releases"

    id: Mapped[int] = mapped_column(primary_key=True)
    release_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    environment_id: Mapped[int] = mapped_column(ForeignKey("environments.id"))
    version: Mapped[str] = mapped_column(String(64))
    branch: Mapped[str] = mapped_column(String(128))
    strategy: Mapped[str] = mapped_column(String(32), default="rolling")
    artifact_url: Mapped[str] = mapped_column(String(1000), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    current_stage: Mapped[int] = mapped_column(default=0)
    created_by: Mapped[str] = mapped_column(String(64), default="admin")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project = relationship("Project", back_populates="releases")
    environment = relationship("Environment", back_populates="releases")
    steps = relationship("ReleaseStep", back_populates="release", cascade="all, delete-orphan")
    logs = relationship("ReleaseLog", back_populates="release", cascade="all, delete-orphan")
    deployments = relationship(
        "ReleaseDeployment", back_populates="release", cascade="all, delete-orphan"
    )


class ReleaseStep(TimestampMixin, Base):
    __tablename__ = "release_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey("releases.id"))
    sequence: Mapped[int]
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default="waiting")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    release = relationship("Release", back_populates="steps")


class ReleaseLog(Base):
    __tablename__ = "release_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey("releases.id"))
    level: Mapped[str] = mapped_column(String(16), default="INFO")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    release = relationship("Release", back_populates="logs")


class ReleaseDeployment(Base):
    __tablename__ = "release_deployments"

    id: Mapped[int] = mapped_column(primary_key=True)
    release_id: Mapped[int] = mapped_column(ForeignKey("releases.id"), index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("deployment_targets.id"))
    target_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default="waiting")
    deployed_path: Mapped[str] = mapped_column(String(500), default="")
    previous_path: Mapped[str] = mapped_column(String(500), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    release = relationship("Release", back_populates="deployments")
