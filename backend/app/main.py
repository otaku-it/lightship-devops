from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.services.seed import seed_database
from app.services.schema_migrations import run_schema_migrations
from app.models.release import Release, ReleaseDeployment, ReleaseLog, ReleaseStep


def fail_interrupted_releases(db) -> None:
    releases = list(db.scalars(select(Release).where(Release.status.in_(("pending", "running")))))
    for release in releases:
        release.status = "failed"
        release.finished_at = datetime.utcnow()
        for step in db.scalars(select(ReleaseStep).where(ReleaseStep.release_id == release.id, ReleaseStep.status == "running")):
            step.status = "failed"
            step.finished_at = datetime.utcnow()
        for deployment in db.scalars(select(ReleaseDeployment).where(ReleaseDeployment.release_id == release.id, ReleaseDeployment.status == "running")):
            deployment.status = "failed"
            deployment.message = "发布执行期间平台服务发生重启，任务已中断，请重新发起发布"
            deployment.finished_at = datetime.utcnow()
        db.add(ReleaseLog(release_id=release.id, level="ERROR", message="平台服务重启导致执行任务中断，已自动结束本次发布，请重新发起"))
    if releases:
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_schema_migrations(engine)
    with SessionLocal() as db:
        seed_database(db)
        fail_interrupted_releases(db)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lightship-api"}
