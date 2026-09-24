from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_admin, require_release_manager
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.platform import PlatformSetting
from app.models.user import User
from app.schemas.audit import AuditLogRead
from app.schemas.platform import PlatformSettingsRead, PlatformSettingsUpdate
from app.services.audit import record_audit
from app.services.platform_settings import load_platform_settings

router = APIRouter(tags=["平台"])

@router.get("/platform/settings", response_model=PlatformSettingsRead)
def get_platform_settings(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> PlatformSettingsRead:
    return PlatformSettingsRead.model_validate(load_platform_settings(db).__dict__)


@router.put("/platform/settings", response_model=PlatformSettingsRead)
def update_platform_settings(payload: PlatformSettingsUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)) -> PlatformSettingsRead:
    for key, value in payload.model_dump().items():
        if key == "executor_mode":
            continue
        item = db.get(PlatformSetting, key)
        if not item:
            item = PlatformSetting(key=key)
            db.add(item)
        item.value = str(value).lower() if isinstance(value, bool) else str(value)
        item.updated_by = user.username
    record_audit(db, user, action="platform.settings.update", resource_type="platform", summary="更新平台发布设置", detail=payload.model_dump())
    db.commit()
    return get_platform_settings(db, user)


@router.get("/audit-logs", response_model=list[AuditLogRead])
def list_audit_logs(
    actor: str = "",
    action: str = "",
    result: str = "",
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_release_manager),
) -> list[AuditLogRead]:
    query = select(AuditLog).order_by(desc(AuditLog.id)).limit(limit)
    if actor.strip():
        keyword = f"%{actor.strip()}%"
        query = query.where(
            or_(
                AuditLog.actor_username.ilike(keyword),
                AuditLog.actor_display_name.ilike(keyword),
            )
        )
    if action.strip():
        query = query.where(AuditLog.action == action.strip())
    if result.strip():
        query = query.where(AuditLog.result == result.strip())
    return [AuditLogRead.model_validate(item, from_attributes=True) for item in db.scalars(query)]
