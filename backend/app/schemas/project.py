from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    name: str
    description: str = ""
    project_type: str
    repository_url: str
    default_branch: str = "main"
    build_command: str = ""
    artifact_pattern: str = ""
    health_path: str = "/health"
    deployment_mode: str = "file"
    dockerfile_path: str = "Dockerfile"
    docker_image_name: str = ""
    docker_container_port: int = 8080
    docker_run_args: str = ""
    compose_file_path: str = "docker-compose.yml"
    compose_project_name: str = ""


class ProjectCreate(ProjectBase):
    git_username: str = ""
    git_token: str = Field(default="", repr=False)


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    release_count: int = 0
    success_rate: float = 0
    credential_configured: bool = False
    git_username: str = ""

    model_config = ConfigDict(from_attributes=True)


class RepositoryBranchesRequest(BaseModel):
    project_id: int | None = None
    repository_url: str = ""
    git_username: str = ""
    git_token: str = Field(default="", repr=False)


class RepositoryBranchesRead(BaseModel):
    branches: list[str]
    default_branch: str = ""
