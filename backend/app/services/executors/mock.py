import random
import time

from app.models.environment import DeploymentTarget
from datetime import datetime

from app.services.executors.base import ConnectionResult, ServiceControlResult, ServiceStatusResult


class MockExecutor:
    def control_service(self, target: DeploymentTarget, **kwargs) -> ServiceControlResult:
        del target
        return ServiceControlResult(
            success=False,
            message="模拟执行器未执行服务控制操作",
            detail="请将 EXECUTOR_MODE 设置为 real 后再暂停、启用或重启真实服务",
        )

    def check_service_status(self, target: DeploymentTarget, **kwargs) -> ServiceStatusResult:
        del target
        return ServiceStatusResult(
            status="unknown",
            healthy=False,
            message="模拟执行模式不能读取真实服务状态",
            detail="请将 EXECUTOR_MODE 设置为 real 后再检查目标服务器",
            version=kwargs.get("version", ""),
            release_no=kwargs.get("release_no", ""),
            runtime=kwargs.get("deployment_mode", ""),
            checked_at=datetime.utcnow(),
        )

    def test_connection(
        self,
        target: DeploymentTarget,
        *,
        private_key: str | None = None,
        password: str | None = None,
        passphrase: str | None = None,
        expected_fingerprint: str = "",
        trust_on_first_use: bool = False,
    ) -> ConnectionResult:
        del private_key, password, passphrase, expected_fingerprint, trust_on_first_use
        started = time.perf_counter()
        time.sleep(0.15)
        latency = max(12, int((time.perf_counter() - started) * 1000) + random.randint(2, 24))
        return ConnectionResult(
            success=True,
            latency_ms=latency,
            message="连接测试通过（模拟执行器）",
            system_info=target.system_info or "Ubuntu 22.04 · systemd 252 · x86_64",
        )
