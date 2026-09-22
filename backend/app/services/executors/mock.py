import random
import time

from app.models.environment import DeploymentTarget
from app.services.executors.base import ConnectionResult


class MockExecutor:
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
