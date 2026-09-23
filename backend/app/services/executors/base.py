from dataclasses import dataclass
from datetime import datetime
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


@dataclass
class ServiceStatusResult:
    status: str
    healthy: bool
    message: str
    detail: str = ""
    version: str = ""
    release_no: str = ""
    runtime: str = ""
    latency_ms: int = 0
    checked_at: datetime | None = None


@dataclass
class ServiceControlResult:
    success: bool
    message: str
    detail: str = ""
    latency_ms: int = 0


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
