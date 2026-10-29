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

    auth_jwt_secret: SecretStr
    auth_jwt_algorithm: Literal["HS256"] = "HS256"
    auth_jwt_issuer: str = "fitmap-api"
    auth_jwt_audience: str = "fitmap-mobile"
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 30

    # Not required until recovery is enabled. Never reuse JWT credentials.
    auth_recovery_code_secret: SecretStr | None = None

    # Required only for email verification; independent of JWT and recovery keys.
    auth_email_verification_secret: SecretStr | None = None

    # Transport remains disabled until outbox, sender verification and HTTP controls exist.
    email_provider: Literal["disabled", "resend"] = "disabled"
    resend_api_key: SecretStr | None = None
    email_from_address: str | None = None
    email_timeout_seconds: float = 5.0

    # Required only when enqueuing/decoding encrypted outbox payloads.
    # Generate a Fernet key independently and keep it server-side.
    email_outbox_encryption_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
