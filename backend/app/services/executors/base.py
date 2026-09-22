from dataclasses import dataclass
from typing import Protocol

from app.models.environment import DeploymentTarget


@dataclass
class ConnectionResult:
    success: bool
    latency_ms: int
    message: str
    system_info: str = ""
    host_key_fingerprint: str = ""


@dataclass
class DeploymentResult:
    success: bool
    message: str
    deployed_path: str = ""
    previous_path: str = ""
    logs: tuple[str, ...] = ()


class TargetExecutor(Protocol):
    def test_connection(
        self,
        target: DeploymentTarget,
        *,
        private_key: str | None = None,
        password: str | None = None,
        passphrase: str | None = None,
        expected_fingerprint: str = "",
        trust_on_first_use: bool = False,
    ) -> ConnectionResult: ...
