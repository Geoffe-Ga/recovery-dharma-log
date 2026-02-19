"""Application configuration via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "Recovery Dharma Secretary Log"
    database_url: str = "sqlite:///./rd_log.db"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    model_config = {"env_prefix": "RD_LOG_"}


settings = Settings()
