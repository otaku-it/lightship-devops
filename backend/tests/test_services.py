import tarfile
from types import SimpleNamespace

from app.services.credentials import decrypt_secret, encrypt_secret
from app.services.artifact_builder import ArtifactBuilder
from app.services.executors.ssh import render_template
from app.services.git_repository import list_remote_branches


def test_credentials_round_trip():
    encrypted = encrypt_secret("secret-value")
    assert encrypted != "secret-value"
    assert decrypt_secret(encrypted) == "secret-value"


def test_deployment_template_rendering():
    rendered = render_template(
        "/opt/apps/{project}/releases/{version}",
        {"project": "demo", "version": "1.2.3"},
    )
    assert rendered == "/opt/apps/demo/releases/1.2.3"


def test_list_remote_branches_parses_default_branch(monkeypatch):
    import app.services.git_repository as git_repository

    monkeypatch.setattr(
        git_repository.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(
            returncode=0,
            stdout=(
                "ref: refs/heads/develop\tHEAD\n"
                "abc\trefs/heads/main\n"
                "def\trefs/heads/develop\n"
                "ghi\trefs/heads/feature/login\n"
            ),
            stderr="",
        ),
    )
    branches, default_branch = list_remote_branches("https://example.com/team/app.git")
    assert default_branch == "develop"
    assert branches == ["develop", "feature/login", "main"]


def test_package_docker_context(tmp_path):
    builder = ArtifactBuilder(tmp_path, log=lambda *_: None)
    builder.source_dir.mkdir()
    (builder.source_dir / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
    (builder.source_dir / "app.txt").write_text("hello", encoding="utf-8")
    (builder.source_dir / ".git").mkdir()
    (builder.source_dir / ".git" / "secret").write_text("ignore", encoding="utf-8")
    archive_path, digest, size = builder.package_docker_context("Dockerfile")
    assert size > 0
    assert len(digest) == 64
    with tarfile.open(archive_path, "r:gz") as archive:
        names = archive.getnames()
    assert "Dockerfile" in names
    assert "app.txt" in names
    assert ".git/secret" not in names


def test_package_compose_context(tmp_path):
    builder = ArtifactBuilder(tmp_path, log=lambda *_: None)
    builder.source_dir.mkdir()
    (builder.source_dir / "docker-compose.yml").write_text(
        "services:\n  api:\n    build: .\n", encoding="utf-8"
    )
    (builder.source_dir / "frontend.js").write_text("console.log('ok')", encoding="utf-8")
    archive_path, digest, size = builder.package_compose_context("docker-compose.yml")
    assert size > 0
    assert len(digest) == 64
    with tarfile.open(archive_path, "r:gz") as archive:
        names = archive.getnames()
    assert "docker-compose.yml" in names
    assert "frontend.js" in names
