from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    username = decode_access_token(credentials.credentials)
    user = db.scalar(select(User).where(User.username == username)) if username else None
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有平台管理员可以执行此操作")
    return user


def require_operator(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"admin", "release_manager", "developer"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只读用户不能执行写操作")
    return user


def require_release_manager(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"admin", "release_manager"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有管理员或发布管理员可以执行此操作")
    return user
