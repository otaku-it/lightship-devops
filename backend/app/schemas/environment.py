from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EnvironmentCreate(BaseModel):
    name: str
    slug: str
    approval_required: bool = False
    release_window: str = "全天开放"


class EnvironmentRead(EnvironmentCreate):
    id: int
    target_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TargetBase(BaseModel):
    project_id: int | None = None
    environment_id: int
    name: str
    connection_type: str
    address: str
    port: int = 22
    username: str = "deploy"
    deploy_path: str = "/opt/apps/{project}/releases/{version}"
    start_command: str = "systemctl restart {project}"
    stop_command: str = "systemctl stop {project}"
    health_check_command: str = "curl --fail http://127.0.0.1:{service_port}/health"


class TargetCreate(TargetBase):
    project_id: int
    auth_type: str = "password"
    password: str = Field(default="", repr=False)
    private_key: str = Field(default="", repr=False)
    passphrase: str = Field(default="", repr=False)
    host_key_fingerprint: str = ""
    trust_on_first_use: bool = True
    service_port: int = 8080


class TargetRead(TargetBase):
    id: int
    credential_ref: str = ""
    status: str
    system_info: str
    environment_name: str = ""
    project_name: str = ""
    created_at: datetime
    auth_type: str = "password"
    credential_configured: bool = False
    host_key_fingerprint: str = ""
    trust_on_first_use: bool = True
    service_port: int = 8080

    model_config = ConfigDict(from_attributes=True)


class ConnectionTestRequest(BaseModel):
    private_key: str | None = Field(default=None, repr=False)
    password: str | None = Field(default=None, repr=False)
    passphrase: str | None = Field(default=None, repr=False)


class ConnectionTestResult(BaseModel):
    success: bool
    latency_ms: int
    message: str
    system_info: str = ""
    host_key_fingerprint: str = ""


class ServiceControlRequest(BaseModel):
    action: str


class ServiceControlRead(BaseModel):
    target_id: int
    action: str
    success: bool
    message: str
    detail: str = ""
    latency_ms: int = 0


class ServiceStatusRead(BaseModel):
    target_id: int
    project_id: int
    status: str
    healthy: bool
    message: str
    detail: str = ""
    version: str = ""
    release_no: str = ""
    runtime: str = ""
    latency_ms: int = 0
    checked_at: datetime
