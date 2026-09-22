from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.environment import DeploymentTarget, Environment
from app.models.project import Project
from app.models.user import User


def seed_database(db: Session) -> None:
    if not db.scalar(select(User).where(User.username == settings.initial_admin_username)):
        db.add(
            User(
                username=settings.initial_admin_username,
                password_hash=hash_password(settings.initial_admin_password),
                display_name="Sunny",
                role="admin",
            )
        )

    if not db.scalar(select(Project.id).limit(1)):
        db.add_all(
            [
                Project(name="order-service", description="订单域核心服务", project_type="java", repository_url="https://git.example.com/core/order-service.git", default_branch="release/2.7.4", build_command="./mvnw clean package -DskipTests=false", artifact_pattern="target/*.jar", health_path="/actuator/health"),
                Project(name="merchant-console", description="商家运营控制台", project_type="frontend", repository_url="https://git.example.com/web/merchant-console.git", default_branch="main", build_command="npm ci && npm run build", artifact_pattern="dist/**", health_path="/"),
                Project(name="risk-engine", description="风控规则计算服务", project_type="python", repository_url="https://git.example.com/risk/risk-engine.git", default_branch="main", build_command="pip wheel . -w dist", artifact_pattern="dist/*.whl", health_path="/health"),
            ]
        )
        db.flush()

    projects = {project.name: project for project in db.scalars(select(Project))}

    if not db.scalar(select(Environment.id).limit(1)):
        test = Environment(name="测试环境", slug="test", release_window="全天开放")
        staging = Environment(name="预发环境", slug="staging", release_window="09:00-22:00")
        prod = Environment(name="生产环境", slug="prod", approval_required=True, release_window="09:30-17:30")
        db.add_all([test, staging, prod])
        db.flush()
        db.add_all(
            [
                DeploymentTarget(project_id=projects["order-service"].id, environment_id=prod.id, name="prod-app-01", connection_type="agent", address="10.20.3.11", status="online", system_info="Ubuntu 22.04 · systemd 252"),
                DeploymentTarget(project_id=projects["merchant-console"].id, environment_id=prod.id, name="prod-web-01", connection_type="ssh", address="10.20.3.21", status="online", system_info="Rocky Linux 9"),
                DeploymentTarget(project_id=projects["risk-engine"].id, environment_id=staging.id, name="staging-cluster", connection_type="kubernetes", address="k8s.staging.local", status="online", system_info="Kubernetes v1.31.2"),
                DeploymentTarget(project_id=projects["risk-engine"].id, environment_id=test.id, name="test-worker-01", connection_type="agent", address="10.20.8.16", status="offline", system_info="Ubuntu 20.04"),
            ]
        )
    demo_bindings = {
        "prod-app-01": "order-service",
        "prod-web-01": "merchant-console",
        "staging-cluster": "risk-engine",
        "test-worker-01": "risk-engine",
    }
    for target in db.scalars(select(DeploymentTarget).where(DeploymentTarget.project_id.is_(None))):
        project_name = demo_bindings.get(target.name)
        if project_name and project_name in projects:
            target.project_id = projects[project_name].id
    if settings.executor_mode != "mock":
        for target in db.scalars(select(DeploymentTarget)):
            if not target.access:
                target.status = "unknown"
    db.commit()
