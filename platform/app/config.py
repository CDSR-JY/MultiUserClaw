"""Platform gateway configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Platform configuration loaded from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://nanobot:nanobot@localhost:5432/nanobot_platform"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 hours
    jwt_refresh_token_expire_days: int = 30

    # LLM Provider API Keys (platform-level, never exposed to containers)
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    openrouter_api_key: str = ""
    dashscope_api_key: str = ""
    aihubmix_api_key: str = ""
    moonshot_api_key: str = ""
    zhipu_api_key: str = ""

    # Default model for new users
    default_model: str = "claude-sonnet-4-5"

    # Docker
    nanobot_image: str = "nanobot:latest"
    container_network: str = "nanobot-internal"
    container_memory_limit: str = "512m"
    container_cpu_limit: float = 1.0
    container_pids_limit: int = 100
    container_data_dir: str = "/data/nanobot-users"

    # Idle management
    container_idle_pause_minutes: int = 30
    container_idle_archive_days: int = 30

    # Quotas (tokens per day)
    quota_free: int = 20000000
    quota_basic: int = 1_000_000
    quota_pro: int = 10_000_000

    # Platform gateway
    host: str = "0.0.0.0"
    port: int = 8080

    model_config = {"env_prefix": "PLATFORM_"}


settings = Settings()
