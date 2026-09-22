from app.core.config import settings
from app.services.executors.mock import MockExecutor
from app.services.executors.ssh import SSHExecutor


def get_executor(connection_type: str):
    if settings.executor_mode == "mock":
        return MockExecutor()
    if connection_type.upper() == "SSH":
        return SSHExecutor()
    raise ValueError(f"真实发布暂不支持 {connection_type.upper()} 连接，请使用 SSH 目标")
