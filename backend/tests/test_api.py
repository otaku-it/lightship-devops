def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login(client):
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "change-me-now"})
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_seeded_resources(client, auth_headers):
    projects = client.get("/api/v1/projects", headers=auth_headers)
    targets = client.get("/api/v1/targets", headers=auth_headers)
    environments = client.get("/api/v1/environments", headers=auth_headers)
    assert projects.status_code == 200
    assert len(projects.json()) == 3
    assert len(targets.json()) == 4
    assert len(environments.json()) == 3


def test_create_release(client, auth_headers):
    payload = {
        "project_id": 1,
        "environment_id": 3,
        "version": "1.0.0",
        "branch": "main",
        "strategy": "rolling",
        "notes": "API test release",
    }
    response = client.post("/api/v1/releases", headers=auth_headers, json=payload)
    assert response.status_code == 201
    assert response.json()["release_no"].startswith("REL-")
    detail = client.get(f"/api/v1/releases/{response.json()['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert len(detail.json()["steps"]) == 4


def test_reject_unsupported_release_strategy(client, auth_headers):
    payload = {
        "project_id": 1,
        "environment_id": 3,
        "version": "1.0.1",
        "branch": "main",
        "strategy": "blue_green",
        "notes": "unsupported strategy",
    }
    response = client.post("/api/v1/releases", headers=auth_headers, json=payload)
    assert response.status_code == 422
    assert "逐台发布" in response.json()["detail"]


def test_target_credentials_are_write_only(client, auth_headers):
    payload = {
        "project_id": 1,
        "environment_id": 1,
        "name": "test-real-ssh",
        "connection_type": "ssh",
        "address": "127.0.0.1",
        "port": 22,
        "username": "deploy",
        "auth_type": "password",
        "password": "top-secret-password",
        "service_port": 8080,
        "deploy_path": "/opt/apps/{project}/releases/{version}",
        "start_command": "systemctl restart {project}",
        "health_check_command": "curl --fail http://127.0.0.1:{service_port}/health",
    }
    response = client.post("/api/v1/targets", headers=auth_headers, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["credential_configured"] is True
    assert "password" not in body
    listed = client.get("/api/v1/targets", headers=auth_headers).json()
    target = next(item for item in listed if item["name"] == "test-real-ssh")
    assert "top-secret-password" not in str(target)


def test_project_git_token_is_write_only(client, auth_headers):
    payload = {
        "name": "private-project",
        "description": "private repo",
        "project_type": "python",
        "repository_url": "https://git.example.com/private/project.git",
        "default_branch": "main",
        "build_command": "python -m build",
        "artifact_pattern": "dist/*.whl",
        "health_path": "/health",
        "git_username": "git-user",
        "git_token": "git-secret-token",
    }
    response = client.post("/api/v1/projects", headers=auth_headers, json=payload)
    assert response.status_code == 201
    assert response.json()["credential_configured"] is True
    assert "git_token" not in response.json()
    assert "git-secret-token" not in response.text


def test_create_docker_project(client, auth_headers):
    payload = {
        "name": "docker-service",
        "description": "containerized service",
        "project_type": "java",
        "repository_url": "https://git.example.com/team/docker-service.git",
        "default_branch": "main",
        "deployment_mode": "docker",
        "dockerfile_path": "deploy/Dockerfile",
        "docker_image_name": "company/docker-service",
        "docker_container_port": 8080,
        "docker_run_args": "--env APP_ENV=prod",
    }
    response = client.post("/api/v1/projects", headers=auth_headers, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["deployment_mode"] == "docker"
    assert body["dockerfile_path"] == "deploy/Dockerfile"
    assert body["docker_container_port"] == 8080


def test_create_compose_project(client, auth_headers):
    payload = {
        "name": "full-stack-compose",
        "description": "frontend and backend services",
        "project_type": "frontend",
        "repository_url": "https://git.example.com/team/full-stack.git",
        "default_branch": "main",
        "deployment_mode": "compose",
        "compose_file_path": "deploy/docker-compose.yml",
        "compose_project_name": "full-stack",
    }
    response = client.post("/api/v1/projects", headers=auth_headers, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["deployment_mode"] == "compose"
    assert body["compose_file_path"] == "deploy/docker-compose.yml"
    assert body["compose_project_name"] == "full-stack"


def test_reject_invalid_compose_project_name(client, auth_headers):
    payload = {
        "name": "invalid-compose-name",
        "project_type": "frontend",
        "repository_url": "https://git.example.com/team/full-stack.git",
        "deployment_mode": "compose",
        "compose_file_path": "docker-compose.yml",
        "compose_project_name": "bad name",
    }
    response = client.post("/api/v1/projects", headers=auth_headers, json=payload)
    assert response.status_code == 422


def test_delete_release_target_and_project(client, auth_headers):
    project = client.post(
        "/api/v1/projects",
        headers=auth_headers,
        json={
            "name": "deletion-test-project",
            "project_type": "python",
            "repository_url": "https://git.example.com/test/deletion.git",
        },
    )
    assert project.status_code == 201
    project_id = project.json()["id"]

    target = client.post(
        "/api/v1/targets",
        headers=auth_headers,
        json={
            "project_id": project_id,
            "environment_id": 1,
            "name": "deletion-test-target",
            "connection_type": "ssh",
            "address": "127.0.0.1",
        },
    )
    assert target.status_code == 201
    target_id = target.json()["id"]

    release = client.post(
        "/api/v1/releases",
        headers=auth_headers,
        json={
            "project_id": project_id,
            "environment_id": 1,
            "version": "1.0.0",
            "branch": "main",
            "strategy": "rolling",
        },
    )
    assert release.status_code == 201
    release_id = release.json()["id"]

    deleted_release = client.delete(
        f"/api/v1/releases/{release_id}", headers=auth_headers
    )
    assert deleted_release.status_code == 204
    assert client.get(
        f"/api/v1/releases/{release_id}", headers=auth_headers
    ).status_code == 404

    deleted_target = client.delete(
        f"/api/v1/targets/{target_id}", headers=auth_headers
    )
    assert deleted_target.status_code == 204
    assert all(
        item["id"] != target_id
        for item in client.get("/api/v1/targets", headers=auth_headers).json()
    )

    deleted_project = client.delete(
        f"/api/v1/projects/{project_id}", headers=auth_headers
    )
    assert deleted_project.status_code == 204
    assert client.get(
        f"/api/v1/projects/{project_id}", headers=auth_headers
    ).status_code == 404


def test_delete_project_cascades_history_and_targets(client, auth_headers):
    from app.core.database import SessionLocal
    from app.models.release import ReleaseDeployment

    project = client.post(
        "/api/v1/projects",
        headers=auth_headers,
        json={
            "name": "cascade-delete-project",
            "project_type": "frontend",
            "repository_url": "https://git.example.com/test/cascade.git",
        },
    ).json()
    target = client.post(
        "/api/v1/targets",
        headers=auth_headers,
        json={
            "project_id": project["id"],
            "environment_id": 1,
            "name": "cascade-delete-target",
            "connection_type": "ssh",
            "address": "127.0.0.2",
        },
    ).json()
    release = client.post(
        "/api/v1/releases",
        headers=auth_headers,
        json={
            "project_id": project["id"],
            "environment_id": 1,
            "version": "2.0.0",
            "branch": "main",
            "strategy": "rolling",
        },
    ).json()

    with SessionLocal() as db:
        db.add(
            ReleaseDeployment(
                release_id=release["id"],
                target_id=target["id"],
                target_name=target["name"],
                status="success",
            )
        )
        db.commit()

    blocked_target_delete = client.delete(
        f"/api/v1/targets/{target['id']}", headers=auth_headers
    )
    assert blocked_target_delete.status_code == 409
    assert "发布结果引用" in blocked_target_delete.json()["detail"]

    response = client.delete(
        f"/api/v1/projects/{project['id']}", headers=auth_headers
    )
    assert response.status_code == 204
    assert client.get(
        f"/api/v1/releases/{release['id']}", headers=auth_headers
    ).status_code == 404
    assert all(
        item["id"] != target["id"]
        for item in client.get("/api/v1/targets", headers=auth_headers).json()
    )
