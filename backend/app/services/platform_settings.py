from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.platform import PlatformSetting


@dataclass(frozen=True)
class RuntimePlatformSettings:
    executor_mode: str
    build_timeout_seconds: int
    ssh_command_timeout_seconds: int
    health_check_retries: int
    auto_rollback: bool
    max_build_log_lines: int


def _value(db: Session, key: str, default: str) -> str:
    item = db.get(PlatformSetting, key)
    return item.value if item else default


def load_platform_settings(db: Session) -> RuntimePlatformSettings:
    return RuntimePlatformSettings(
        executor_mode=settings.executor_mode,
        build_timeout_seconds=int(
            _value(db, "build_timeout_seconds", str(settings.build_timeout_seconds))
        ),
        ssh_command_timeout_seconds=int(
            _value(
                db,
                "ssh_command_timeout_seconds",
                str(settings.ssh_command_timeout_seconds),
            )
        ),
        health_check_retries=int(_value(db, "health_check_retries", "10")),
        auto_rollback=_value(db, "auto_rollback", "true").lower() == "true",
        max_build_log_lines=int(
            _value(db, "max_build_log_lines", str(settings.max_build_log_lines))
        ),
    )
