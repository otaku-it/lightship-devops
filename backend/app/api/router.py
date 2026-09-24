from fastapi import APIRouter

from app.api.routes import auth, dashboard, environments, platform, projects, releases

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(projects.router)
api_router.include_router(environments.router)
api_router.include_router(releases.router)
api_router.include_router(platform.router)
