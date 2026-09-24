import json

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def record_audit(db: Session, user: User | None, *, action: str, resource_type: str, resource_id: int | str = "", summary: str, detail: dict | str | None = None, result: str = "success") -> AuditLog:
    if isinstance(detail, dict):
        detail = json.dumps(detail, ensure_ascii=False, default=str)
    item = AuditLog(actor_id=user.id if user else None, actor_username=user.username if user else "system", actor_display_name=user.display_name if user else "系统", action=action, resource_type=resource_type, resource_id=str(resource_id or ""), summary=summary, detail=detail or "", result=result)
    db.add(item)
    return item
