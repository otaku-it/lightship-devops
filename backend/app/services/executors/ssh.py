import base64
import hashlib
import io
import posixpath
import re
import select
import shlex
import time
from datetime import datetime
from pathlib import Path

import paramiko

from app.core.config import settings
from app.models.environment import DeploymentTarget
from app.services.executors.base import ConnectionResult, DeploymentResult, ServiceControlResult, ServiceStatusResult


def fingerprint(key: paramiko.PKey) -> str:
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode().rstrip("=")


class FingerprintPolicy(paramiko.MissingHostKeyPolicy):
    def __init__(self, expected: str, trust_on_first_use: bool):
        self.expected = expected.strip()
        self.trust_on_first_use = trust_on_first_use
        self.observed = ""

    def missing_host_key(self, client, hostname, key):  # noqa: ANN001
        self.observed = fingerprint(key)
        if self.expected and self.observed != self.expected:
            raise paramiko.SSHException(
                f"服务器指纹不匹配，期望 {self.expected}，实际 {self.observed}"
            )
        if not self.expected and not self.trust_on_first_use:
            raise paramiko.SSHException(
                f"服务器指纹尚未信任：{self.observed}，请核对后保存"
            )
        client.get_host_keys().add(hostname, key.get_name(), key)


def load_private_key(value: str, passphrase: str | None) -> paramiko.PKey:
    errors: list[Exception] = []
    for key_class in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey):
        try:
            return key_class.from_private_key(io.StringIO(value), password=passphrase or None)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
    raise ValueError("无法识别 SSH 私钥或私钥口令不正确") from errors[-1]


def render_template(value: str, variables: dict[str, str | int]) -> str:
    try:
        rendered = value.format_map(variables)
    except KeyError as exc:
        raise ValueError(f"命令模板包含未知变量：{exc.args[0]}") from exc
    if "\n" in rendered or "\x00" in rendered:
        raise ValueError("部署路径和命令不能包含换行或空字符")
    return rendered


class SSHExecutor:
    def __init__(self, runtime_settings=None) -> None:
        self.build_timeout_seconds = (
            runtime_settings.build_timeout_seconds
            if runtime_settings
            else settings.build_timeout_seconds
        )
        self.command_timeout_seconds = (
            runtime_settings.ssh_command_timeout_seconds
            if runtime_settings
            else settings.ssh_command_timeout_seconds
        )
        self.health_check_retries = (
            runtime_settings.health_check_retries if runtime_settings else 10
        )
        self.auto_rollback = runtime_settings.auto_rollback if runtime_settings else True

    def _connect(
        self,
        target: DeploymentTarget,
        *,
        private_key: str | None,
        password: str | None,
        passphrase: str | None,
        expected_fingerprint: str,
        trust_on_first_use: bool,
    ) -> tuple[paramiko.SSHClient, str]:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        policy = FingerprintPolicy(expected_fingerprint, trust_on_first_use)
        client.set_missing_host_key_policy(policy)
        key = load_private_key(private_key, passphrase) if private_key else None
        client.connect(
            hostname=target.address,
            port=target.port,
            username=target.username,
            pkey=key,
            password=password or None,
            timeout=10,
            banner_timeout=10,
            auth_timeout=10,
            look_for_keys=False,
            allow_agent=False,
        )
        server_key = client.get_transport().get_remote_server_key()
        observed = policy.observed or fingerprint(server_key)
        if expected_fingerprint and observed != expected_fingerprint:
            client.close()
            raise paramiko.SSHException(
                f"服务器指纹不匹配，期望 {expected_fingerprint}，实际 {observed}"
            )
        return client, observed

    def _run(
        self,
        client: paramiko.SSHClient,
        command: str,
        timeout: int | None = None,
        on_output=None,
    ) -> tuple[int, str, str]:
        _, stdout, stderr = client.exec_command(
            command, timeout=timeout or self.command_timeout_seconds
        )
        channel = stdout.channel
        deadline = time.monotonic() + (timeout or self.command_timeout_seconds)
        output = bytearray()
        error = bytearray()
        emitted = bytearray()
        emitted_error = bytearray()
        last_heartbeat = time.monotonic()
        while not channel.exit_status_ready():
            if time.monotonic() >= deadline:
                channel.close()
                message = "远程命令执行超时"
                if on_output:
                    on_output(message)
                return 124, output.decode(errors="replace").strip(), message
            readable, _, _ = select.select([channel], [], [], 1)
            if not readable:
                continue
            while channel.recv_ready():
                chunk = channel.recv(65536)
                if not chunk:
                    break
                output.extend(chunk)
            while channel.recv_stderr_ready():
                chunk = channel.recv_stderr(65536)
                if not chunk:
                    break
                error.extend(chunk)
            if on_output and output:
                fresh = output[len(emitted):]
                emitted.extend(fresh)
                for line in fresh.decode(errors="replace").splitlines():
                    if line.strip():
                        on_output(line.strip()[-2000:])
                        last_heartbeat = time.monotonic()
            if on_output and error:
                fresh_error = error[len(emitted_error):]
                emitted_error.extend(fresh_error)
                for line in fresh_error.decode(errors="replace").splitlines():
                    if line.strip():
                        on_output(line.strip()[-2000:])
                        last_heartbeat = time.monotonic()
            if on_output and time.monotonic() - last_heartbeat >= 15:
                on_output("远程命令仍在执行，等待 Docker 返回结果…")
                last_heartbeat = time.monotonic()
        while channel.recv_ready():
            output.extend(channel.recv(65536))
        while channel.recv_stderr_ready():
            error.extend(channel.recv_stderr(65536))
        exit_code = channel.recv_exit_status()
        return exit_code, output.decode(errors="replace").strip(), error.decode(errors="replace").strip()

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
        client = None
        started = time.perf_counter()
        observed = ""
        try:
            client, observed = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            code, output, error = self._run(
                client, "uname -srm && . /etc/os-release && printf '%s %s' \"$NAME\" \"$VERSION_ID\""
            )
            if code != 0:
                raise RuntimeError(error or "系统信息读取失败")
            message = "SSH 认证、服务器指纹与只读系统检查通过"
            if target.project and target.project.deployment_mode in {"docker", "compose"}:
                docker_command = "docker version --format 'Docker {{.Server.Version}}' && docker info --format '{{.OSType}}/{{.Architecture}}'"
                if target.project.deployment_mode == "compose":
                    docker_command += " && (docker compose version || docker-compose version)"
                docker_code, docker_output, docker_error = self._run(
                    client,
                    docker_command,
                )
                if docker_code != 0:
                    raise RuntimeError(
                        "Docker 不可用或当前 SSH 用户无 Docker 权限："
                        f"{docker_error or docker_output}"
                    )
                output = f"{output} · {docker_output.replace(chr(10), ' ')}"
                message = "SSH、Docker Engine 与 Compose 检查通过，可执行多服务部署" if target.project.deployment_mode == "compose" else "SSH 与 Docker Engine 检查通过，可执行容器部署"
            return ConnectionResult(
                success=True,
                latency_ms=int((time.perf_counter() - started) * 1000),
                message=message,
                system_info=output,
                host_key_fingerprint=observed,
            )
        except Exception as exc:  # noqa: BLE001
            return ConnectionResult(
                success=False,
                latency_ms=int((time.perf_counter() - started) * 1000),
                message=f"SSH 连接失败：{exc}",
                host_key_fingerprint=observed,
            )
        finally:
            if client:
                client.close()

    def check_service_status(
        self,
        target: DeploymentTarget,
        *,
        project_name: str,
        deployment_mode: str,
        version: str = "",
        release_no: str = "",
        deployed_path: str = "",
        docker_container_port: int = 0,
        compose_project_name: str = "",
        private_key: str = "",
        password: str = "",
        passphrase: str = "",
        expected_fingerprint: str = "",
        trust_on_first_use: bool = False,
        service_port: int = 0,
    ) -> ServiceStatusResult:
        client = None
        started = time.perf_counter()
        checked_at = datetime.utcnow()
        safe_project = re.sub(r"[^a-zA-Z0-9_.-]+", "-", project_name).strip("-.").lower()
        runtime = {"docker": "Docker", "compose": "Docker Compose", "file": "文件 / 进程"}.get(deployment_mode, deployment_mode)
        try:
            client, _ = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            detail = ""
            if deployment_mode == "docker":
                container_name = f"lightship-{safe_project}-{target.id}"
                command = (
                    f"docker inspect -f '{{{{.State.Status}}}}|{{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{else}}}}none{{{{end}}}}|"
                    f"{{{{.Config.Image}}}}|{{{{.State.StartedAt}}}}' {shlex.quote(container_name)}"
                )
                code, output, error = self._run(client, command, timeout=20)
                if code != 0:
                    return ServiceStatusResult(status="stopped", healthy=False, message="容器未运行或不存在", detail=(error or output)[-2000:], version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                state, health, image, started_at = (output.split("|", 3) + ["", "", "", ""])[:4]
                detail = f"容器 {container_name} · 镜像 {image} · 启动时间 {started_at}"
                if state != "running":
                    return ServiceStatusResult(status="stopped", healthy=False, message=f"容器状态：{state}", detail=detail, version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                if health == "unhealthy":
                    return ServiceStatusResult(status="unhealthy", healthy=False, message="容器健康检查异常", detail=detail, version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                variables = {"project": project_name, "version": version, "release_no": release_no, "service_port": service_port, "port": service_port, "container_port": docker_container_port, "container_name": container_name, "image": image}
                health_command = render_template(target.health_check_command, variables) if target.health_check_command else ""
                if health_command:
                    health_code, health_output, health_error = self._run(client, health_command, timeout=30)
                    if health_code != 0:
                        return ServiceStatusResult(status="unhealthy", healthy=False, message="容器运行中，但应用健康检查失败", detail=(health_error or health_output or detail)[-2000:], version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                message = "容器运行正常，应用健康检查通过" if health_command else "容器运行正常"
            elif deployment_mode == "compose":
                compose_project = compose_project_name.strip() or f"lightship-{safe_project}"
                command = (
                    "docker ps -a --filter " + shlex.quote(f"label=com.docker.compose.project={compose_project}") +
                    " --format '{{.Names}}|{{.State}}|{{.Status}}|{{.Image}}'"
                )
                code, output, error = self._run(client, command, timeout=20)
                if code != 0:
                    raise RuntimeError(error or output or "Docker Compose 状态读取失败")
                lines = [line for line in output.splitlines() if line.strip()]
                if not lines:
                    return ServiceStatusResult(status="stopped", healthy=False, message="未找到 Compose 服务", detail=f"Compose 项目：{compose_project}", version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                stopped = [line.split("|", 1)[0] for line in lines if "|running|" not in line]
                unhealthy = [line.split("|", 1)[0] for line in lines if "unhealthy" in line.lower()]
                detail = "\n".join(lines)[-4000:]
                if stopped:
                    return ServiceStatusResult(status="stopped", healthy=False, message=f"{len(stopped)} 个服务未运行：{'、'.join(stopped)}", detail=detail, version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                if unhealthy:
                    return ServiceStatusResult(status="unhealthy", healthy=False, message=f"{len(unhealthy)} 个服务健康异常：{'、'.join(unhealthy)}", detail=detail, version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                message = f"Compose 的 {len(lines)} 个服务均在运行"
            else:
                variables = {"project": project_name, "version": version, "release_no": release_no, "service_port": service_port, "port": service_port, "deploy_path": deployed_path, "current_path": posixpath.join(posixpath.dirname(posixpath.dirname(deployed_path.rstrip("/"))), "current") if deployed_path else ""}
                if not target.health_check_command:
                    return ServiceStatusResult(status="unknown", healthy=False, message="未配置健康检查命令", detail="请在目标服务器配置中填写健康检查命令", version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                command = render_template(target.health_check_command, variables)
                code, output, error = self._run(client, command, timeout=30)
                if code != 0:
                    return ServiceStatusResult(status="unhealthy", healthy=False, message="进程健康检查失败", detail=(error or output)[-2000:], version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
                detail = output[-2000:]
                message = "服务健康检查通过"
            return ServiceStatusResult(status="running", healthy=True, message=message, detail=detail, version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
        except Exception as exc:  # noqa: BLE001
            return ServiceStatusResult(status="unreachable", healthy=False, message="无法读取服务状态", detail=str(exc)[-2000:], version=version, release_no=release_no, runtime=runtime, latency_ms=int((time.perf_counter()-started)*1000), checked_at=checked_at)
        finally:
            if client:
                client.close()

    def control_service(
        self,
        target: DeploymentTarget,
        *,
        action: str,
        project_name: str,
        deployment_mode: str,
        stop_command: str = "",
        start_command: str = "",
        compose_file_path: str = "docker-compose.yml",
        compose_project_name: str = "",
        private_key: str = "",
        password: str = "",
        passphrase: str = "",
        expected_fingerprint: str = "",
        trust_on_first_use: bool = False,
        service_port: int = 0,
    ) -> ServiceControlResult:
        client = None
        started = time.perf_counter()
        safe_project = re.sub(r"[^a-zA-Z0-9_.-]+", "-", project_name).strip("-.").lower()
        if deployment_mode not in {"file", "docker", "compose"}:
            return ServiceControlResult(False, "不支持的部署方式", deployment_mode)
        try:
            client, _ = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            if action not in {"stop", "start", "restart"}:
                raise ValueError("服务控制动作不合法")
            if deployment_mode == "docker":
                container_name = f"lightship-{safe_project}-{target.id}"
                command = f"docker {action} {shlex.quote(container_name)}"
            elif deployment_mode == "compose":
                compose_project = compose_project_name.strip() or f"lightship-{safe_project}"
                current_file = f"/opt/lightship-compose/{safe_project}/current/{compose_file_path.strip() or 'docker-compose.yml'}"
                compose_bin = "docker compose" if self._run(client, "docker compose version >/dev/null 2>&1", timeout=15)[0] == 0 else "docker-compose"
                compose = f"{compose_bin} -p {shlex.quote(compose_project)} -f {shlex.quote(current_file)}"
                command = f"{compose} {action}"
            else:
                variables = {"project": project_name, "service_port": service_port, "port": service_port}
                command_template = stop_command if action == "stop" else start_command
                if not command_template.strip():
                    raise ValueError("未配置服务控制命令")
                command = render_template(command_template, variables)
            code, output, error = self._run(client, command, timeout=120)
            detail = (output or error).strip()[-2000:]
            if code != 0:
                return ServiceControlResult(False, f"服务{ {'stop':'暂停','start':'启用','restart':'重启'}[action] }失败", detail, int((time.perf_counter() - started) * 1000))
            return ServiceControlResult(True, f"服务已{ {'stop':'暂停','start':'启用','restart':'重启'}[action] }", detail, int((time.perf_counter() - started) * 1000))
        except Exception as exc:  # noqa: BLE001
            return ServiceControlResult(False, "服务控制失败", str(exc)[-2000:], int((time.perf_counter() - started) * 1000))
        finally:
            if client:
                client.close()

    def deploy_docker(
        self,
        target: DeploymentTarget,
        *,
        archive_path: Path,
        project_name: str,
        version: str,
        release_no: str,
        service_port: int,
        dockerfile_path: str,
        docker_image_name: str,
        docker_container_port: int,
        docker_run_args: str,
        health_check_command: str,
        private_key: str,
        password: str,
        passphrase: str,
        expected_fingerprint: str,
        trust_on_first_use: bool,
        progress_callback=None,
    ) -> DeploymentResult:
        client = None
        logs: list[str] = []
        safe_project = re.sub(r"[^a-zA-Z0-9_.-]+", "-", project_name).strip("-.").lower()
        safe_version = re.sub(r"[^a-zA-Z0-9_.-]+", "-", version).strip("-.").lower()
        if not safe_project or not safe_version:
            raise ValueError("项目名或版本号无法转换为合法 Docker 名称")
        image_base = docker_image_name.strip() or f"lightship/{safe_project}"
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_./:-]*", image_base):
            raise ValueError("Docker 镜像名称格式不合法")
        if ":" in image_base.rsplit("/", 1)[-1]:
            raise ValueError("Docker 镜像名称请勿包含标签，平台会自动生成版本标签")
        image_ref = f"{image_base}:{safe_version}-{release_no.lower()}"
        container_name = f"lightship-{safe_project}-{target.id}"
        context_dir = f"/tmp/lightship-docker-{release_no.lower()}"
        remote_archive = f"{context_dir}.tar.gz"
        dockerfile = dockerfile_path.strip().replace("\\", "/") or "Dockerfile"
        if dockerfile.startswith("/") or ".." in dockerfile.split("/"):
            raise ValueError("Dockerfile 路径必须是仓库内的相对路径")
        try:
            extra_args = " ".join(shlex.quote(item) for item in shlex.split(docker_run_args))
        except ValueError as exc:
            raise ValueError(f"Docker 运行参数格式错误：{exc}") from exc
        port_args = (
            f"-p {int(service_port)}:{int(docker_container_port)}"
            if service_port and docker_container_port
            else ""
        )
        run_options = " ".join(item for item in ["--restart unless-stopped", port_args, extra_args] if item)
        previous_image = ""
        switched = False
        variables: dict[str, str | int] = {
            "project": project_name,
            "version": version,
            "release_no": release_no,
            "service_port": service_port,
            "port": service_port,
            "container_port": docker_container_port,
            "container_name": container_name,
            "image": image_ref,
        }
        health_command = render_template(health_check_command, variables)
        try:
            client, _ = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            logs.append("SSH 会话已建立，开始 Docker 部署")
            code, output, error = self._run(client, "docker info --format '{{.ServerVersion}}'")
            if code != 0:
                raise RuntimeError(f"Docker Engine 不可用：{error or output}")
            logs.append(f"Docker Engine {output.strip()} 可用")
            with client.open_sftp() as sftp:
                sftp.put(str(archive_path), remote_archive)
            prepare = (
                f"rm -rf {shlex.quote(context_dir)} && mkdir -p {shlex.quote(context_dir)} && "
                f"tar -xzf {shlex.quote(remote_archive)} -C {shlex.quote(context_dir)}"
            )
            code, output, error = self._run(client, prepare)
            if code != 0:
                raise RuntimeError(f"解压 Docker 构建上下文失败：{error or output}")
            logs.append("Docker 构建上下文已上传并解压")
            raw_build_command = (
                f"docker build -f {shlex.quote(posixpath.join(context_dir, dockerfile))} "
                f"-t {shlex.quote(image_ref)} {shlex.quote(context_dir)}"
            )
            build_log = f"/tmp/lightship-docker-build-{release_no.lower()}.log"
            build_command = (
                f"{raw_build_command} > {shlex.quote(build_log)} 2>&1; "
                f"code=$?; tail -n 80 {shlex.quote(build_log)}; rm -f {shlex.quote(build_log)}; exit $code"
            )
            code, output, error = self._run(
                client, build_command, timeout=self.build_timeout_seconds
            )
            build_tail = (output or error)[-3000:].strip()
            if build_tail:
                logs.append(build_tail)
            if code != 0:
                raise RuntimeError(f"Docker 镜像构建失败：{error or output}")
            logs.append(f"镜像构建完成：{image_ref}")
            _, output, _ = self._run(
                client,
                f"docker inspect -f '{{{{.Config.Image}}}}' {shlex.quote(container_name)} 2>/dev/null || true",
            )
            previous_image = output.strip()
            replace_command = (
                f"docker rm -f {shlex.quote(container_name)} >/dev/null 2>&1 || true; "
                f"docker run -d --name {shlex.quote(container_name)} {run_options} {shlex.quote(image_ref)}"
            )
            switched = True
            code, output, error = self._run(client, replace_command, on_output=progress_callback)
            if code != 0:
                raise RuntimeError(f"启动 Docker 容器失败：{error or output}")
            logs.append(f"容器 {container_name} 已切换到新镜像")
            if health_command:
                retry_numbers = " ".join(str(item) for item in range(1, self.health_check_retries + 1))
                retry_health = (
                    f"for i in {retry_numbers}; do ({health_command}) && exit 0; "
                    "sleep 2; done; exit 1"
                )
                code, output, error = self._run(
                    client,
                    retry_health,
                    timeout=max(30, self.health_check_retries * 10),
                )
                if output:
                    logs.append(output[-2000:])
                if code != 0:
                    raise RuntimeError(f"健康检查失败：{error or output}")
                logs.append("容器健康检查通过")
            return DeploymentResult(
                success=True,
                message="Docker 镜像构建完成，容器已更新且服务健康",
                deployed_path=image_ref,
                previous_path=previous_image,
                logs=tuple(logs),
            )
        except Exception as exc:  # noqa: BLE001
            if client and switched and self.auto_rollback:
                self._run(
                    client,
                    f"docker rm -f {shlex.quote(container_name)} >/dev/null 2>&1 || true",
                )
                if previous_image:
                    rollback = (
                        f"docker run -d --name {shlex.quote(container_name)} {run_options} {shlex.quote(previous_image)}"
                    )
                    self._run(client, rollback)
                    logs.append(f"已回滚容器到上一镜像 {previous_image}")
                else:
                    logs.append("新容器已移除；此前没有可回滚的旧容器")
            return DeploymentResult(
                success=False,
                message=str(exc),
                deployed_path=image_ref,
                previous_path=previous_image,
                logs=tuple(logs),
            )
        finally:
            if client:
                try:
                    self._run(
                        client,
                        f"rm -rf {shlex.quote(context_dir)} {shlex.quote(remote_archive)}",
                    )
                except Exception:  # noqa: BLE001
                    pass
                client.close()

    def deploy(
        self,
        target: DeploymentTarget,
        *,
        archive_path: Path,
        project_name: str,
        version: str,
        release_no: str,
        service_port: int,
        private_key: str,
        password: str,
        passphrase: str,
        expected_fingerprint: str,
        trust_on_first_use: bool,
        progress_callback=None,
    ) -> DeploymentResult:
        client = None
        logs: list[str] = []
        variables: dict[str, str | int] = {
            "project": project_name,
            "version": version,
            "release_no": release_no,
            "service_port": service_port,
            "port": service_port,
        }
        deploy_path = render_template(target.deploy_path, variables)
        if not deploy_path.startswith("/"):
            raise ValueError("版本部署目录必须是绝对路径")
        app_root = posixpath.dirname(posixpath.dirname(deploy_path.rstrip("/")))
        current_path = posixpath.join(app_root, "current")
        variables.update({"deploy_path": deploy_path, "current_path": current_path})
        start_command = render_template(target.start_command, variables)
        health_command = render_template(target.health_check_command, variables)
        remote_archive = f"/tmp/lightship-{release_no}.tar.gz"
        previous_path = ""
        switched = False
        try:
            client, _ = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            logs.append("SSH 会话已建立")
            with client.open_sftp() as sftp:
                sftp.put(str(archive_path), remote_archive)
            logs.append(f"制品已上传至 {remote_archive}")

            prepare = (
                f"mkdir -p {shlex.quote(deploy_path)} && "
                f"tar -xzf {shlex.quote(remote_archive)} -C {shlex.quote(deploy_path)} && "
                f"rm -f {shlex.quote(remote_archive)}"
            )
            code, output, error = self._run(client, prepare)
            if code != 0:
                raise RuntimeError(f"解压制品失败：{error or output}")
            logs.append(f"制品已解压至 {deploy_path}")

            _, output, _ = self._run(
                client, f"readlink -f {shlex.quote(current_path)} 2>/dev/null || true"
            )
            previous_path = output.strip()
            switch = (
                f"mkdir -p {shlex.quote(app_root)} && "
                f"ln -sfn {shlex.quote(deploy_path)} {shlex.quote(current_path)}"
            )
            code, output, error = self._run(client, switch)
            if code != 0:
                raise RuntimeError(f"切换当前版本失败：{error or output}")
            switched = True
            logs.append(f"当前版本已切换到 {deploy_path}")

            if start_command:
                code, output, error = self._run(client, start_command)
                if output:
                    logs.append(output[-2000:])
                if code != 0:
                    raise RuntimeError(f"启动/重启命令失败：{error or output}")
                logs.append("启动/重启命令执行成功")
            if health_command:
                retry_numbers = " ".join(str(item) for item in range(1, self.health_check_retries + 1))
                retry_health = (
                    f"for i in {retry_numbers}; do ({health_command}) && exit 0; "
                    "sleep 2; done; exit 1"
                )
                code, output, error = self._run(
                    client,
                    retry_health,
                    timeout=max(30, self.health_check_retries * 10),
                )
                if output:
                    logs.append(output[-2000:])
                if code != 0:
                    raise RuntimeError(f"健康检查失败：{error or output}")
                logs.append("健康检查通过")
            return DeploymentResult(
                success=True,
                message="真实部署完成，服务健康",
                deployed_path=deploy_path,
                previous_path=previous_path,
                logs=tuple(logs),
            )
        except Exception as exc:  # noqa: BLE001
            if client and switched and previous_path and self.auto_rollback:
                rollback = (
                    f"ln -sfn {shlex.quote(previous_path)} {shlex.quote(current_path)}"
                )
                self._run(client, rollback)
                if start_command:
                    self._run(client, start_command)
                logs.append(f"已回滚到 {previous_path}")
            return DeploymentResult(
                success=False,
                message=str(exc),
                deployed_path=deploy_path,
                previous_path=previous_path,
                logs=tuple(logs),
            )
        finally:
            if client:
                try:
                    self._run(client, f"rm -f {shlex.quote(remote_archive)}")
                except Exception:  # noqa: BLE001
                    pass
                client.close()

    def deploy_compose(
        self,
        target: DeploymentTarget,
        *,
        archive_path: Path,
        project_name: str,
        version: str,
        release_no: str,
        service_port: int,
        compose_file_path: str,
        compose_project_name: str,
        private_key: str,
        password: str,
        passphrase: str,
        expected_fingerprint: str,
        trust_on_first_use: bool,
        progress_callback=None,
    ) -> DeploymentResult:
        client = None
        logs: list[str] = []
        safe_project = re.sub(r"[^a-zA-Z0-9_.-]+", "-", project_name).strip("-.").lower()
        safe_version = re.sub(r"[^a-zA-Z0-9_.-]+", "-", version).strip("-.").lower()
        if not safe_project or not safe_version:
            raise ValueError("项目名或版本号无法转换为合法 Compose 名称")
        compose_project = compose_project_name.strip() or f"lightship-{safe_project}"
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]*", compose_project):
            raise ValueError("Compose 项目名格式不合法")
        compose_file = compose_file_path.strip().replace("\\", "/") or "docker-compose.yml"
        if compose_file.startswith("/") or ".." in compose_file.split("/"):
            raise ValueError("Compose 文件路径必须是仓库内的相对路径")
        root_dir = f"/opt/lightship-compose/{safe_project}"
        context_dir = f"{root_dir}/releases/{safe_version}-{release_no.lower()}"
        current_link = f"{root_dir}/current"
        remote_archive = f"/tmp/lightship-compose-{release_no.lower()}.tar.gz"
        previous_dir = ""
        compose = ""
        started_new = False
        try:
            client, _ = self._connect(
                target,
                private_key=private_key,
                password=password,
                passphrase=passphrase,
                expected_fingerprint=expected_fingerprint,
                trust_on_first_use=trust_on_first_use,
            )
            logs.append("SSH 会话已建立，开始 Docker Compose 部署")
            code, output, error = self._run(client, "docker info --format '{{.ServerVersion}}' && (docker compose version || docker-compose version)")
            if code != 0:
                raise RuntimeError(f"Docker Compose 不可用：{error or output}")
            logs.append(f"Docker Compose 可用：{output.replace(chr(10), ' ')}")
            compose_bin = "docker compose" if self._run(client, "docker compose version >/dev/null 2>&1")[0] == 0 else "docker-compose"
            compose = f"{compose_bin} -p {shlex.quote(compose_project)} -f {shlex.quote(posixpath.join(context_dir, compose_file))}"
            with client.open_sftp() as sftp:
                sftp.put(str(archive_path), remote_archive)
            prepare = (
                f"mkdir -p {shlex.quote(context_dir)} && "
                f"tar -xzf {shlex.quote(remote_archive)} -C {shlex.quote(context_dir)}"
            )
            code, output, error = self._run(client, prepare)
            if code != 0:
                raise RuntimeError(f"解压 Compose 构建上下文失败：{error or output}")
            logs.append(f"Compose 文件已上传：{compose_file}")
            code, output, error = self._run(
                client,
                f"{compose} config --quiet",
                timeout=self.build_timeout_seconds,
            )
            if code != 0:
                raise RuntimeError(f"Compose 配置校验失败：{error or output}")
            logs.append("Compose 配置校验通过")
            _, previous_dir, _ = self._run(client, f"readlink -f {shlex.quote(current_link)} 2>/dev/null || true")
            previous_dir = previous_dir.strip()
            build_command = f"{compose} build"
            if progress_callback:
                progress_callback("开始执行 docker compose build，正在构建前后端及依赖服务")
            code, output, error = self._run(client, build_command, timeout=self.build_timeout_seconds, on_output=progress_callback)
            if (output or error).strip():
                logs.append((output or error)[-4000:])
            if code != 0:
                raise RuntimeError(f"Compose 镜像构建失败：{error or output}")
            logs.append("Compose 所有服务镜像构建完成")
            started_new = True
            if progress_callback:
                progress_callback("开始执行 docker compose up -d，正在更新多服务")
            code, output, error = self._run(client, f"{compose} up -d --remove-orphans", timeout=self.build_timeout_seconds, on_output=progress_callback)
            if (output or error).strip():
                logs.append((output or error)[-4000:])
            if code != 0:
                raise RuntimeError(f"Compose 服务启动失败：{error or output}")
            logs.append("Compose 多服务已启动")
            code, output, error = self._run(client, f"{compose} ps --all", timeout=60, on_output=progress_callback)
            if code != 0:
                raise RuntimeError(f"Compose 服务状态检查失败：{error or output}")
            logs.append(output[-4000:])
            code, output, error = self._run(client, f"{compose} ps --status running --services", timeout=60, on_output=progress_callback)
            if code != 0 or not output.strip():
                raise RuntimeError(f"没有运行中的 Compose 服务：{error or output}")
            exited_code, exited_services, exited_error = self._run(
                client, f"{compose} ps --status exited --services", timeout=60, on_output=progress_callback
            )
            if exited_code != 0:
                raise RuntimeError(f"Compose 服务状态检查失败：{exited_error or exited_services}")
            if exited_services.strip():
                raise RuntimeError(f"Compose 服务异常退出：{exited_services}")
            logs.append("Compose 服务状态检查通过")
            code, output, error = self._run(
                client,
                f"mkdir -p {shlex.quote(root_dir)} && rm -f {shlex.quote(current_link)} && ln -s {shlex.quote(context_dir)} {shlex.quote(current_link)}",
            )
            if code != 0:
                raise RuntimeError(f"切换 Compose 当前版本失败：{error or output}")
            logs.append(f"Compose 当前版本已切换到 {context_dir}")
            return DeploymentResult(
                success=True,
                message="Docker Compose 多服务已更新并启动",
                deployed_path=context_dir,
                previous_path=previous_dir,
                logs=tuple(logs),
            )
        except Exception as exc:  # noqa: BLE001
            if client and compose and started_new and self.auto_rollback:
                self._run(client, f"{compose} down --remove-orphans", timeout=60)
                if previous_dir:
                    previous_compose = f"{compose.split(' -f ', 1)[0]} -f {shlex.quote(posixpath.join(previous_dir, compose_file))}"
                    rollback_code, rollback_output, rollback_error = self._run(
                        client, f"{previous_compose} up -d --remove-orphans", timeout=self.build_timeout_seconds
                    )
                    if rollback_code == 0:
                        logs.append("已回滚到上一版 Compose 服务")
                    else:
                        logs.append(f"上一版 Compose 回滚失败：{rollback_error or rollback_output}",)
            return DeploymentResult(success=False, message=str(exc), deployed_path=context_dir, previous_path=previous_dir, logs=tuple(logs))
        finally:
            if client:
                try:
                    self._run(client, f"rm -f {shlex.quote(remote_archive)}")
                except Exception:  # noqa: BLE001
                    pass
                client.close()
