from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.environment import DeploymentTarget
from app.models.release import Release
from app.models.user import User
from app.schemas.dashboard import DashboardStats
from app.api.routes.releases import release_query, release_read

router = APIRouter(prefix="/dashboard", tags=["总览"])


@router.get("", response_model=DashboardStats)
def dashboard(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> DashboardStats:
    releases = list(db.scalars(select(Release)))
    successes = [item for item in releases if item.status == "success"]
    durations = [
        int((item.finished_at - item.started_at).total_seconds())
        for item in successes
        if item.started_at and item.finished_at
    ]
    total_targets = db.scalar(select(func.count()).select_from(DeploymentTarget)) or 0
    online_targets = db.scalar(select(func.count()).select_from(DeploymentTarget).where(DeploymentTarget.status == "online")) or 0
    recent = db.scalars(release_query().order_by(Release.id.desc()).limit(5)).unique().all()
    return DashboardStats(
        today_releases=sum(1 for item in releases if item.created_at.date() == date.today()),
        success_rate=round(len(successes) / len(releases) * 100, 1) if releases else 0,
        average_duration_seconds=int(sum(durations) / len(durations)) if durations else 0,
        online_targets=online_targets,
        total_targets=total_targets,
        pending_releases=sum(1 for item in releases if item.status in {"pending", "running"}),
        recent_releases=[release_read(item) for item in recent],
    )

