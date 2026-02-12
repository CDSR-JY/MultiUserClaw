"""Docker container lifecycle management for per-user nanobot instances."""

from __future__ import annotations

import secrets
from pathlib import Path

import docker
from docker.errors import NotFound as DockerNotFound
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Container

_client: docker.DockerClient | None = None


def _docker() -> docker.DockerClient:
    global _client
    if _client is None:
        _client = docker.from_env()
    return _client


def _ensure_network() -> None:
    """Create the internal Docker network if it doesn't exist."""
    client = _docker()
    try:
        client.networks.get(settings.container_network)
    except DockerNotFound:
        client.networks.create(
            settings.container_network,
            driver="bridge",
            internal=True,  # no internet access from this network
        )


async def get_container(db: AsyncSession, user_id: str) -> Container | None:
    result = await db.execute(select(Container).where(Container.user_id == user_id))
    return result.scalar_one_or_none()


async def get_container_by_token(db: AsyncSession, token: str) -> Container | None:
    result = await db.execute(select(Container).where(Container.container_token == token))
    return result.scalar_one_or_none()


async def create_container(db: AsyncSession, user_id: str) -> Container:
    """Create a Docker container for a user and record metadata in DB."""
    _ensure_network()
    client = _docker()

    container_token = secrets.token_urlsafe(32)

    # Host directory for user data persistence
    user_data = Path(settings.container_data_dir) / user_id
    workspace_dir = user_data / "workspace"
    sessions_dir = user_data / "sessions"
    workspace_dir.mkdir(parents=True, exist_ok=True)
    sessions_dir.mkdir(parents=True, exist_ok=True)

    docker_container = client.containers.run(
        image=settings.nanobot_image,
        command=["web", "--port", "18080", "--host", "0.0.0.0"],
        name=f"nanobot-user-{user_id[:8]}",
        detach=True,
        environment={
            "NANOBOT_PROXY__URL": f"http://gateway:8080/llm/v1",
            "NANOBOT_PROXY__TOKEN": container_token,
            "NANOBOT_AGENTS__DEFAULTS__MODEL": settings.default_model,
            # No API keys here — they stay on the platform side
        },
        volumes={
            str(workspace_dir): {"bind": "/root/.nanobot/workspace", "mode": "rw"},
            str(sessions_dir): {"bind": "/root/.nanobot/sessions", "mode": "rw"},
        },
        network=settings.container_network,
        mem_limit=settings.container_memory_limit,
        nano_cpus=int(settings.container_cpu_limit * 1e9),
        pids_limit=settings.container_pids_limit,
        restart_policy={"Name": "unless-stopped"},
    )

    # Read container IP on the internal network
    docker_container.reload()
    network_settings = docker_container.attrs["NetworkSettings"]["Networks"]
    internal_ip = network_settings.get(settings.container_network, {}).get("IPAddress", "")

    record = Container(
        user_id=user_id,
        docker_id=docker_container.id,
        container_token=container_token,
        status="running",
        internal_host=internal_ip,
        internal_port=18080,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def ensure_running(db: AsyncSession, user_id: str) -> Container:
    """Return a running container for the user, creating or unpausing as needed."""
    record = await get_container(db, user_id)

    if record is None:
        return await create_container(db, user_id)

    client = _docker()

    if record.status == "paused":
        try:
            c = client.containers.get(record.docker_id)
            c.unpause()
            await db.execute(
                update(Container)
                .where(Container.id == record.id)
                .values(status="running")
            )
            await db.commit()
            record.status = "running"
        except DockerNotFound:
            # Container was removed externally — recreate
            await db.delete(record)
            await db.commit()
            return await create_container(db, user_id)

    elif record.status == "archived":
        # Recreate from persisted data volumes
        await db.delete(record)
        await db.commit()
        return await create_container(db, user_id)

    elif record.status == "running":
        # Verify it's actually running
        try:
            c = client.containers.get(record.docker_id)
            if c.status != "running":
                c.start()
        except DockerNotFound:
            await db.delete(record)
            await db.commit()
            return await create_container(db, user_id)

    return record


async def pause_container(db: AsyncSession, user_id: str) -> bool:
    """Pause a user's container to save resources."""
    record = await get_container(db, user_id)
    if record is None or record.status != "running":
        return False

    client = _docker()
    try:
        c = client.containers.get(record.docker_id)
        c.pause()
        await db.execute(
            update(Container).where(Container.id == record.id).values(status="paused")
        )
        await db.commit()
        return True
    except DockerNotFound:
        return False


async def destroy_container(db: AsyncSession, user_id: str) -> bool:
    """Stop and remove a user's container (data volumes are preserved)."""
    record = await get_container(db, user_id)
    if record is None:
        return False

    client = _docker()
    try:
        c = client.containers.get(record.docker_id)
        c.stop(timeout=10)
        c.remove()
    except DockerNotFound:
        pass

    await db.delete(record)
    await db.commit()
    return True
