import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse


def list_remote_branches(
    repository_url: str,
    *,
    username: str = "",
    token: str = "",
    timeout_seconds: int = 30,
) -> tuple[list[str], str]:
    parsed = urlparse(repository_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("当前只支持通过 HTTP/HTTPS Git 地址识别分支")

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    with tempfile.TemporaryDirectory(prefix="lightship-git-branches-") as temp_dir:
        if token:
            askpass_path = Path(temp_dir) / "git-askpass.sh"
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
                    "LIGHTSHIP_GIT_USERNAME": username or "oauth2",
                    "LIGHTSHIP_GIT_TOKEN": token,
                }
            )

        try:
            result = subprocess.run(
                ["git", "ls-remote", "--symref", repository_url, "HEAD", "refs/heads/*"],
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("读取远程分支超时，请检查仓库网络和访问权限") from exc

    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "未知错误"
        raise RuntimeError(f"读取远程分支失败：{detail[:500]}")

    default_branch = ""
    branches: list[str] = []
    for line in result.stdout.splitlines():
        if line.startswith("ref: refs/heads/") and line.endswith("\tHEAD"):
            default_branch = line.removeprefix("ref: refs/heads/").removesuffix("\tHEAD")
            continue
        if "\trefs/heads/" not in line:
            continue
        branch = line.split("\trefs/heads/", 1)[1].strip()
        if branch and branch not in branches:
            branches.append(branch)

    branches.sort(key=lambda item: (item != default_branch, item.lower()))
    if not branches:
        raise RuntimeError("远程仓库没有可用分支，或当前凭证无权读取")
    return branches, default_branch
