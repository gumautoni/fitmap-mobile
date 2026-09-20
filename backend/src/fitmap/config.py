from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="FITMAP_",
        extra="ignore",
    )

    environment: Literal["development", "test", "staging", "production"] = "development"
    app_name: str = "FitMap API"
    api_v1_prefix: str = "/api/v1"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_name: str = "fitmap"
    db_user: str = "fitmap"
    db_password: SecretStr


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
