import glob
import hashlib
import os
import shutil
import subprocess
import tarfile
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings


class ArtifactBuilder:
    def __init__(
        self,
        workspace: Path,
        *,
        log,
        git_username: str = "",
        git_token: str = "",
    ) -> None:
        self.workspace = workspace
        self.source_dir = workspace / "source"
        self.archive_path = workspace / "artifact.tar.gz"
        self.log = log
        self.git_username = git_username
        self.git_token = git_token

    def checkout(self, repository_url: str, branch: str) -> None:
        parsed = urlparse(repository_url)
        if parsed.scheme not in {"https", "http"}:
            raise ValueError("真实构建当前支持 HTTP/HTTPS Git 仓库")
        env = os.environ.copy()
        askpass_path: Path | None = None
        if self.git_token:
            askpass_path = self.workspace / "git-askpass.sh"
            askpass_path.write_text(
                "#!/bin/sh\n"
                "case \"$1\" in\n"
                "  *Username*) printf '%s' \"$LIGHTSHIP_GIT_USERNAME\" ;;\n"
                "  *) printf '%s' \"$LIGHTSHIP_GIT_TOKEN\" ;;\n"
                "esac\n",
                encoding="utf-8",
            )
            askpass_path.chmod(0o700)
            env.update(
                {
                    "GIT_ASKPASS": str(askpass_path),
                    "GIT_TERMINAL_PROMPT": "0",
                    "LIGHTSHIP_GIT_USERNAME": self.git_username or "oauth2",
                    "LIGHTSHIP_GIT_TOKEN": self.git_token,
                }
            )
        self.log(f"克隆仓库 {parsed.scheme}://{parsed.netloc}{parsed.path}，分支 {branch}")
        command = [
            "git",
            "clone",
            "--depth",
            "1",
            "--single-branch",
            "--branch",
            branch,
            repository_url,
            str(self.source_dir),
        ]
        result = subprocess.run(
            command,
            cwd=self.workspace,
            env=env,
            capture_output=True,
            text=True,
            timeout=settings.build_timeout_seconds,
            check=False,
        )
        if result.returncode != 0 and "dumb http transport" in result.stderr.lower():
            shutil.rmtree(self.source_dir, ignore_errors=True)
            self.log("仓库不支持浅克隆，自动降级为普通克隆", "WARNING")
            command = [
                "git",
                "clone",
                "--single-branch",
                "--branch",
                branch,
                repository_url,
                str(self.source_dir),
            ]
            result = subprocess.run(
                command,
                cwd=self.workspace,
                env=env,
                capture_output=True,
                text=True,
                timeout=settings.build_timeout_seconds,
                check=False,
            )
        if result.returncode != 0:
            raise RuntimeError(f"Git 拉取失败：{result.stderr.strip()[-2000:]}")
        revision = subprocess.run(
            ["git", "rev-parse", "--short=12", "HEAD"],
            cwd=self.source_dir,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        self.log(f"代码拉取完成，提交 {revision}", "SUCCESS")

    def build(self, command: str) -> None:
        if not command.strip():
            raise ValueError("项目未配置构建命令")
        self.log(f"执行构建命令：{command}")
        process = subprocess.Popen(
            ["/bin/bash", "-lc", command],
            cwd=self.source_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        try:
            output, _ = process.communicate(timeout=settings.build_timeout_seconds)
        except subprocess.TimeoutExpired as exc:
            process.kill()
            process.communicate()
            raise RuntimeError(
                f"构建超时（{settings.build_timeout_seconds} 秒）"
            ) from exc
        lines = [line for line in output.splitlines() if line.strip()]
        for line in lines[: settings.max_build_log_lines]:
            self.log(f"[build] {line}")
        return_code = process.returncode
        if len(lines) > settings.max_build_log_lines:
            self.log(f"构建日志过长，已省略 {len(lines) - settings.max_build_log_lines} 行")
        if return_code != 0:
            tail = "\n".join(lines[-20:])
            raise RuntimeError(f"构建命令退出码 {return_code}：{tail}")
        self.log("构建命令执行成功", "SUCCESS")

    def package(self, artifact_pattern: str) -> tuple[Path, str, int]:
        if not artifact_pattern.strip():
            raise ValueError("项目未配置制品匹配规则")
        normalized = artifact_pattern.strip().replace("\\", "/")
        matches = [
            Path(item)
            for item in glob.glob(str(self.source_dir / normalized), recursive=True)
        ]
        files = sorted({item for item in matches if item.is_file()})
        if not files and normalized.endswith("/**"):
            base = self.source_dir / normalized[:-3]
            files = sorted(item for item in base.rglob("*") if item.is_file()) if base.is_dir() else []
        if not files:
            raise FileNotFoundError(f"没有找到匹配制品：{artifact_pattern}")
        base_dir = self.source_dir
        if normalized.endswith("/**"):
            candidate = self.source_dir / normalized[:-3]
            if candidate.is_dir():
                base_dir = candidate
        with tarfile.open(self.archive_path, "w:gz") as archive:
            for item in files:
                archive.add(item, arcname=item.relative_to(base_dir))
        digest = hashlib.sha256(self.archive_path.read_bytes()).hexdigest()
        size = self.archive_path.stat().st_size
        self.log(
            f"制品打包完成：{len(files)} 个文件，{size} bytes，SHA-256 {digest}",
            "SUCCESS",
        )
        return self.archive_path, digest, size

    def package_docker_context(self, dockerfile_path: str) -> tuple[Path, str, int]:
        normalized = dockerfile_path.strip().replace("\\", "/") or "Dockerfile"
        dockerfile = (self.source_dir / normalized).resolve()
        if self.source_dir.resolve() not in dockerfile.parents:
            raise ValueError("Dockerfile 必须位于项目仓库内")
        if not dockerfile.is_file():
            raise FileNotFoundError(f"没有找到 Dockerfile：{normalized}")
        excluded = {".git", ".idea", ".vscode", "node_modules", "__pycache__"}
        files = sorted(
            item for item in self.source_dir.rglob("*")
            if item.is_file() and not any(part in excluded for part in item.relative_to(self.source_dir).parts)
        )
        with tarfile.open(self.archive_path, "w:gz") as archive:
            for item in files:
                archive.add(item, arcname=item.relative_to(self.source_dir))
        digest = hashlib.sha256(self.archive_path.read_bytes()).hexdigest()
        size = self.archive_path.stat().st_size
        self.log(
            f"Docker 构建上下文已打包：{len(files)} 个文件，{size} bytes，SHA-256 {digest}",
            "SUCCESS",
        )
        return self.archive_path, digest, size
