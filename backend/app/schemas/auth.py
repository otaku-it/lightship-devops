from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    display_name: str
    role: str


class UserRead(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    role: str = "developer"

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not value.replace(".", "").replace("-", "").replace("_", "").isalnum():
            raise ValueError("用户名只能包含字母、数字、点、下划线和短横线")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"admin", "release_manager", "developer", "viewer"}:
            raise ValueError("角色不合法")
        return value


class UserUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)
    role: str
    is_active: bool

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"admin", "release_manager", "developer", "viewer"}:
            raise ValueError("角色不合法")
        return value


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)
