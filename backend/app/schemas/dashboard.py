from pydantic import BaseModel

from app.schemas.release import ReleaseRead


class DashboardStats(BaseModel):
    today_releases: int
    success_rate: float
    average_duration_seconds: int
    online_targets: int
    total_targets: int
    pending_releases: int
    recent_releases: list[ReleaseRead]

