from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_schema_migrations(engine: Engine) -> None:
    """Apply the small additive migrations needed by the lightweight deployment."""
    inspector = inspect(engine)
    if "deployment_targets" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("deployment_targets")}
    if "project_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE deployment_targets ADD COLUMN project_id INTEGER NULL")
            )
    if "stop_command" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE deployment_targets ADD COLUMN stop_command VARCHAR(500) NOT NULL DEFAULT 'systemctl stop {project}'")
            )
    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    additions = {
        "deployment_mode": "VARCHAR(32) NOT NULL DEFAULT 'file'",
        "dockerfile_path": "VARCHAR(255) NOT NULL DEFAULT 'Dockerfile'",
        "docker_image_name": "VARCHAR(255) NOT NULL DEFAULT ''",
        "docker_container_port": "INTEGER NOT NULL DEFAULT 8080",
        "docker_run_args": "VARCHAR(1000) NOT NULL DEFAULT ''",
        "compose_file_path": "VARCHAR(255) NOT NULL DEFAULT 'docker-compose.yml'",
        "compose_project_name": "VARCHAR(100) NOT NULL DEFAULT ''",
    }
    with engine.begin() as connection:
        for name, definition in additions.items():
            if name not in project_columns:
                connection.execute(text(f"ALTER TABLE projects ADD COLUMN {name} {definition}"))
