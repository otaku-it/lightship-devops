from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.api.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.auth import LoginRequest, PasswordChange, PasswordReset, TokenResponse, UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    return TokenResponse(
        access_token=create_access_token(user.username),
        display_name=user.display_name,
        role=user.role,
    )


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user, from_attributes=True)


@router.post("/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, str]:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "密码修改成功，请使用新密码重新登录"}


@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[UserRead]:
    return [UserRead.model_validate(item, from_attributes=True) for item in db.scalars(select(User).order_by(User.id))]


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> UserRead:
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="用户名已存在")
    user = User(username=payload.username, display_name=payload.display_name.strip(), password_hash=hash_password(payload.password), role=payload.role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user, from_attributes=True)


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), actor: User = Depends(require_admin)) -> UserRead:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == actor.id and (not payload.is_active or payload.role != "admin"):
        raise HTTPException(status_code=400, detail="不能禁用或降级当前管理员账号")
    if user.role == "admin" and (not payload.is_active or payload.role != "admin"):
        active_admins = db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True))) or 0
        if active_admins <= 1:
            raise HTTPException(status_code=400, detail="至少保留一个启用中的管理员")
    user.display_name = payload.display_name.strip()
    user.role = payload.role
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user, from_attributes=True)


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: int, payload: PasswordReset, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict[str, str]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": f"用户 {user.username} 的密码已重置"}
