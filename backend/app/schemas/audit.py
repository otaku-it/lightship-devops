from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    id: int
    actor_id: int | None
    actor_username: str
    actor_display_name: str
    action: str
    resource_type: str
    resource_id: str
    summary: str
    detail: str
    result: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
