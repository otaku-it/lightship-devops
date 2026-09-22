import tempfile
import time
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.environment import DeploymentTarget
from app.models.project import Project
from app.models.release import Release, ReleaseDeployment, ReleaseLog, ReleaseStep
from app.services.artifact_builder import ArtifactBuilder
from app.services.credentials import decrypt_secret
from app.services.executors.factory import get_executor


def append_log(db, release_id: int, message: str, level: str = "INFO") -> None:
    db.add(ReleaseLog(release_id=release_id, level=level, message=message))
    db.commit()


def set_step(db, release: Release, step: ReleaseStep, status: str) -> None:
    step.status = status
    if status == "running":
        step.started_at = datetime.utcnow()
        release.current_stage = step.sequence
    if status in {"success", "failed", "simulated"}:
        step.finished_at = datetime.utcnow()
    db.commit()


def run_mock_release(db, release: Release, steps: list[ReleaseStep]) -> None:
    append_log(
        db,
        release.id,
        "当前为模拟执行模式，不会拉取仓库或操作目标服务器",
        "WARNING",
    )
    messages = ["模拟代码拉取", "模拟项目构建", "模拟制品打包", "模拟目标部署"]
    for step, message in zip(steps, messages, strict=True):
        set_step(db, release, step, "running")
        append_log(db, release.id, f"开始：{step.name}")
        time.sleep(0.15)
        set_step(db, release, step, "simulated")
        append_log(db, release.id, message, "WARNING")
    release.status = "simulated"
    release.finished_at = datetime.utcnow()
    db.commit()
    append_log(db, release.id, "模拟流程完成；未产生真实部署结果", "WARNING")


def run_real_release(db, release: Release, steps: list[ReleaseStep]) -> None:
    project = release.project
    credential = project.credential
    git_token = decrypt_secret(credential.token_encrypted if credential else "")
    git_username = credential.username if credential else ""

    with tempfile.TemporaryDirectory(prefix=f"lightship-{release.release_no}-") as temp_dir:
        builder = ArtifactBuilder(
            Path(temp_dir),
            log=lambda message, level="INFO": append_log(db, release.id, message, level),
            git_username=git_username,
            git_token=git_token,
        )

        set_step(db, release, steps[0], "running")
        append_log(db, release.id, f"开始：{steps[0].name}")
        builder.checkout(project.repository_url, release.branch)
        set_step(db, release, steps[0], "success")

        set_step(db, release, steps[1], "running")
        append_log(db, release.id, f"开始：{steps[1].name}")
        if project.deployment_mode == "docker":
            append_log(
                db,
                release.id,
                f"Docker 模式：镜像将在目标服务器根据 {project.dockerfile_path} 构建",
            )
        else:
            builder.build(project.build_command)
        set_step(db, release, steps[1], "success")

        set_step(db, release, steps[2], "running")
        append_log(db, release.id, f"开始：{steps[2].name}")
        if project.deployment_mode == "docker":
            archive_path, _, _ = builder.package_docker_context(project.dockerfile_path)
        else:
            archive_path, _, _ = builder.package(project.artifact_pattern)
        set_step(db, release, steps[2], "success")

        set_step(db, release, steps[3], "running")
        append_log(db, release.id, f"开始：{steps[3].name}")
        targets = list(
            db.scalars(
                select(DeploymentTarget)
                .options(selectinload(DeploymentTarget.access))
                .where(
                    DeploymentTarget.environment_id == release.environment_id,
                    DeploymentTarget.project_id == release.project_id,
                )
                .order_by(DeploymentTarget.id)
            )
        )
        if not targets:
            raise RuntimeError("该项目在目标环境中没有配置目标服务器")

        eligible: list[DeploymentTarget] = []
        for target in targets:
            access = target.access
            reason = ""
            if target.connection_type.lower() != "ssh":
                reason = "当前真实发布仅支持 SSH 目标"
            elif not access or not (
                access.password_encrypted or access.private_key_encrypted
            ):
                reason = "尚未配置 SSH 凭证"
            elif target.status != "online":
                reason = "尚未通过真实连接测试"
            if reason:
                db.add(
                    ReleaseDeployment(
                        release_id=release.id,
                        target_id=target.id,
                        target_name=target.name,
                        status="skipped",
                        message=reason,
                        finished_at=datetime.utcnow(),
                    )
                )
                append_log(db, release.id, f"[{target.name}] 已跳过：{reason}", "WARNING")
            else:
                eligible.append(target)
        db.commit()
        if not eligible:
            raise RuntimeError("该项目在此环境中没有已配置凭证且连接测试通过的 SSH 目标")

        for target in eligible:
            deployment = ReleaseDeployment(
                release_id=release.id,
                target_id=target.id,
                target_name=target.name,
                status="running",
                started_at=datetime.utcnow(),
            )
            db.add(deployment)
            db.commit()
            access = target.access
            assert access is not None
            append_log(db, release.id, f"[{target.name}] 开始真实 SSH 部署")
            executor = get_executor(target.connection_type)
            common_args = {
                "archive_path": archive_path,
                "project_name": project.name,
                "version": release.version,
                "release_no": release.release_no,
                "service_port": access.service_port,
                "private_key": decrypt_secret(access.private_key_encrypted),
                "password": decrypt_secret(access.password_encrypted),
                "passphrase": decrypt_secret(access.passphrase_encrypted),
                "expected_fingerprint": access.host_key_fingerprint,
                "trust_on_first_use": access.trust_on_first_use,
            }
            if project.deployment_mode == "docker":
                result = executor.deploy_docker(
                    target,
                    dockerfile_path=project.dockerfile_path,
                    docker_image_name=project.docker_image_name,
                    docker_container_port=project.docker_container_port,
                    docker_run_args=project.docker_run_args,
                    health_check_command=target.health_check_command,
                    **common_args,
                )
            else:
                result = executor.deploy(target, **common_args)
            for line in result.logs:
                append_log(db, release.id, f"[{target.name}] {line}")
            deployment.deployed_path = result.deployed_path
            deployment.previous_path = result.previous_path
            deployment.message = result.message
            deployment.finished_at = datetime.utcnow()
            deployment.status = "success" if result.success else "failed"
            db.commit()
            if not result.success:
                raise RuntimeError(f"{target.name} 部署失败：{result.message}")
            append_log(db, release.id, f"[{target.name}] 真实部署成功", "SUCCESS")

        set_step(db, release, steps[3], "success")


def run_release(release_id: int) -> None:
    with SessionLocal() as db:
        release = db.scalar(
            select(Release)
            .options(
                selectinload(Release.project).selectinload(Project.credential),
                selectinload(Release.environment),
            )
            .where(Release.id == release_id)
        )
        if not release:
            return
        release.status = "running"
        release.started_at = datetime.utcnow()
        db.commit()
        append_log(db, release.id, f"发布任务 {release.release_no} 已进入执行队列")
        steps = list(
            db.scalars(
                select(ReleaseStep)
                .where(ReleaseStep.release_id == release.id)
                .order_by(ReleaseStep.sequence)
            )
        )
        try:
            if settings.executor_mode == "mock":
                run_mock_release(db, release, steps)
                return
            run_real_release(db, release, steps)
            release.status = "success"
            release.finished_at = datetime.utcnow()
            db.commit()
            append_log(db, release.id, "发布完成，所有目标均已部署且健康检查通过", "SUCCESS")
        except Exception as exc:  # noqa: BLE001
            running_step = next((step for step in steps if step.status == "running"), None)
            if running_step:
                set_step(db, release, running_step, "failed")
            release.status = "failed"
            release.finished_at = datetime.utcnow()
            db.commit()
            append_log(db, release.id, f"发布失败：{exc}", "ERROR")
