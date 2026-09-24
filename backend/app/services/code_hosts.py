from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

VALID_ROLES = {"admin", "release_manager", "developer", "viewer"}


def normalize_visible_roles(roles: list[str] | None, *, fallback: list[str] | None = None) -> list[str]:
    selected = [role for role in (roles or fallback or ["admin"]) if role in VALID_ROLES]
    if "admin" not in selected:
        selected.insert(0, "admin")
    return list(dict.fromkeys(selected))


def encode_visible_roles(roles: list[str] | None, *, fallback: list[str] | None = None) -> str:
    return ",".join(normalize_visible_roles(roles, fallback=fallback))


def decode_visible_roles(value: str | None) -> list[str]:
    return normalize_visible_roles((value or "").split(","))


def can_view_connection(connection, user) -> bool:
    return user.role == "admin" or user.role in decode_visible_roles(connection.visible_roles)


@dataclass(frozen=True)
class AccountResult:
    account_name: str
    username: str


def normalize_base_url(provider: str, value: str) -> str:
    value = value.strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("平台地址必须是有效的 HTTP/HTTPS 地址")
    host = parsed.netloc.lower().split(":", 1)[0]
    known_hosts = {"github.com": "github", "gitlab.com": "gitlab", "gitee.com": "gitee"}
    detected = known_hosts.get(host)
    if detected and detected != provider:
        raise ValueError(f"平台类型与地址不匹配：{host} 是 {detected.upper()} 地址，请切换平台类型")
    if provider == "github" and parsed.netloc.lower() == "github.com":
        return "https://github.com"
    if provider == "gitee" and parsed.netloc.lower() == "gitee.com":
        return "https://gitee.com"
    return value


def _api_root(provider: str, base_url: str) -> str:
    if provider == "github":
        return "https://api.github.com" if base_url == "https://github.com" else f"{base_url}/api/v3"
    if provider == "gitlab":
        return f"{base_url}/api/v4"
    return f"{base_url}/api/v5"


def _request(provider: str, base_url: str, token: str, path: str, *, params: dict | None = None):
    headers = {"Accept": "application/json", "User-Agent": "Lightship-DevOps"}
    query = dict(params or {})
    if provider == "github":
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    elif provider == "gitlab":
        headers["PRIVATE-TOKEN"] = token
    else:
        query["access_token"] = token
    try:
        response = httpx.get(
            f"{_api_root(provider, base_url)}{path}",
            headers=headers,
            params=query,
            timeout=15,
            follow_redirects=True,
        )
    except httpx.RequestError as exc:
        raise RuntimeError(f"无法连接代码托管平台：{exc}") from exc
    if response.status_code == 401:
        if provider == "github":
            raise RuntimeError("GitHub 返回 401：访问令牌无效或已过期。请填写 Personal Access Token，不要填写 GitHub 登录密码")
        if provider == "gitlab":
            raise RuntimeError("GitLab 返回 401：访问令牌无效、已过期，或 Token 类型不正确")
        raise RuntimeError("Gitee 返回 401：私人令牌无效或已过期，请重新生成并检查项目读取权限")
    if response.status_code == 403:
        if provider == "github":
            raise RuntimeError("GitHub 返回 403：令牌权限不足、组织 SSO 尚未授权，或触发了 API 限流")
        raise RuntimeError(f"{provider.upper()} 返回 403：令牌权限不足，请检查仓库读取权限")
    if response.status_code >= 400:
        detail = response.text.strip().replace("\n", " ")[:300]
        raise RuntimeError(f"平台接口返回 {response.status_code}：{detail}")
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError("平台接口返回了无法解析的数据") from exc


def test_connection(provider: str, base_url: str, token: str) -> AccountResult:
    if not token:
        raise ValueError("请填写访问令牌")
    data = _request(provider, base_url, token, "/user")
    username = str(data.get("login") or data.get("username") or data.get("name") or "")
    account_name = str(data.get("name") or data.get("login") or data.get("username") or username)
    if not username:
        raise RuntimeError("已连接平台，但未能识别当前账号")
    return AccountResult(account_name=account_name, username=username)


def list_repositories(provider: str, base_url: str, token: str, search: str = "") -> list[dict]:
    if provider == "github":
        data = _request(provider, base_url, token, "/user/repos", params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"})
    elif provider == "gitlab":
        params = {"per_page": 100, "membership": "true", "simple": "true", "order_by": "last_activity_at", "sort": "desc"}
        if search.strip():
            params["search"] = search.strip()
        data = _request(provider, base_url, token, "/projects", params=params)
    else:
        data = _request(provider, base_url, token, "/user/repos", params={"per_page": 100, "sort": "updated"})
    keyword = search.strip().lower()
    result = []
    for item in data:
        full_name = str(item.get("full_name") or item.get("path_with_namespace") or item.get("name") or "")
        if keyword and provider != "gitlab" and keyword not in full_name.lower():
            continue
        result.append(
            {
                "id": str(item.get("id", full_name)),
                "name": str(item.get("name") or full_name.rsplit("/", 1)[-1]),
                "full_name": full_name,
                "clone_url": str(item.get("clone_url") or item.get("http_url_to_repo") or ""),
                "web_url": str(item.get("html_url") or item.get("web_url") or ""),
                "default_branch": str(item.get("default_branch") or ""),
                "private": bool(item.get("private", item.get("visibility") != "public")),
                "description": str(item.get("description") or ""),
            }
        )
    return result
