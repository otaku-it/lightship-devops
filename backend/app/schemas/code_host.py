from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CodeHostConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    provider: str = Field(pattern="^(github|gitlab|gitee)$")
    base_url: str = Field(min_length=1, max_length=500)
    username: str = Field(default="", max_length=255)
    token: str = Field(default="", repr=False)
    visible_roles: list[str] = Field(default_factory=lambda: ["admin"])


class CodeHostConnectionRead(BaseModel):
    id: int
    name: str
    provider: str
    base_url: str
    username: str
    token_configured: bool
    status: str
    account_name: str
    last_error: str
    visible_roles: list[str]
    last_tested_at: datetime | None
    created_at: datetime
    project_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CodeHostTestResult(BaseModel):
    success: bool
    message: str
    account_name: str = ""


class CodeHostRepository(BaseModel):
    id: str
    name: str
    full_name: str
    clone_url: str
    web_url: str
    default_branch: str = ""
    private: bool = False
    description: str = ""
