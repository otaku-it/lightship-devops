from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Lightship DevOps"
    environment: str = "development"
    secret_key: str = "development-secret-change-me"
    database_url: str = (
        "mysql+pymysql://lightship:lightship@localhost:3306/lightship?charset=utf8mb4"
    )
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173", "http://localhost:8088"]
    initial_admin_username: str = "admin"
    initial_admin_password: str = "change-me-now"
    access_token_expire_minutes: int = 480
    executor_mode: str = "mock"
    credential_encryption_key: str = ""
    build_timeout_seconds: int = 900
    ssh_command_timeout_seconds: int = 120
    max_build_log_lines: int = 500

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
