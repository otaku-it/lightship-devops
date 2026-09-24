from pydantic import BaseModel, Field


class PlatformSettingsRead(BaseModel):
    executor_mode: str
    build_timeout_seconds: int
    ssh_command_timeout_seconds: int
    health_check_retries: int
    auto_rollback: bool
    max_build_log_lines: int


class PlatformSettingsUpdate(BaseModel):
    executor_mode: str = Field(pattern="^(real|mock)$")
    build_timeout_seconds: int = Field(ge=60, le=86400)
    ssh_command_timeout_seconds: int = Field(ge=10, le=7200)
    health_check_retries: int = Field(ge=1, le=20)
    auto_rollback: bool
    max_build_log_lines: int = Field(ge=100, le=10000)
