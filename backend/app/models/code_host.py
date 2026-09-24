from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class CodeHostConnection(TimestampMixin, Base):
    __tablename__ = "code_host_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    base_url: Mapped[str] = mapped_column(String(500))
    username: Mapped[str] = mapped_column(String(255), default="")
    token_encrypted: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="untested")
    account_name: Mapped[str] = mapped_column(String(255), default="")
    last_error: Mapped[str] = mapped_column(String(500), default="")
    visible_roles: Mapped[str] = mapped_column(String(255), default="admin")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    projects = relationship("Project", back_populates="code_host_connection")
