from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReleaseCreate(BaseModel):
    project_id: int
    environment_id: int
    version: str
    branch: str
    strategy: str = "rolling"
    artifact_url: str = ""
    notes: str = ""


class ReleaseStepRead(BaseModel):
    id: int
    sequence: int
    name: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ReleaseLogRead(BaseModel):
    id: int
    level: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReleaseDeploymentRead(BaseModel):
    id: int
    target_id: int
    target_name: str
    status: str
    deployed_path: str
    previous_path: str
    message: str
    started_at: datetime | None
    finished_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ReleaseRead(BaseModel):
    id: int
    release_no: str
    project_id: int
    project_name: str = ""
    project_type: str = ""
    environment_id: int
    environment_name: str = ""
    version: str
    branch: str
    strategy: str
    notes: str
    status: str
    current_stage: int
    created_by: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    steps: list[ReleaseStepRead] = Field(default_factory=list)
    logs: list[ReleaseLogRead] = Field(default_factory=list)
    deployments: list[ReleaseDeploymentRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
