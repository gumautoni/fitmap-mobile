from functools import lru_cache
from pathlib import Path
from typing import Literal, Self

from pydantic import EmailStr, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]

_MIN_JWT_SECRET_BYTES = 32

_JWT_PLACEHOLDER_PREFIXES = (
    "replace-with-",
    "change-me",
    "changeme",
    "your-secret",
    "your-jwt-secret",
    "example-",
    "placeholder-",
    "default-secret",
    "insecure-",
)

_JWT_TEST_ONLY_PREFIXES = (
    "fitmap-test-only-",
    "ci-test-only-",
    "test-only-",
)


def _validate_jwt_secret_value(
    value: str,
    *,
    is_test: bool,
) -> None:
    if len(value.encode("utf-8")) < _MIN_JWT_SECRET_BYTES:
        raise ValueError("JWT signing secret must contain at least 32 UTF-8 bytes.")

    if not value.isprintable() or any(char.isspace() for char in value):
        raise ValueError("JWT signing secret must not contain whitespace or control characters.")

    normalized = value.casefold()

    if normalized.startswith(_JWT_PLACEHOLDER_PREFIXES):
        raise ValueError("JWT signing secret must not use an example placeholder.")

    # Reject complete repetitions of a shorter string.
    # This is a weak-pattern check, not an entropy measurement.
    if normalized in (normalized + normalized)[1:-1]:
        raise ValueError("JWT signing secret must not use a repeated pattern.")

    if not is_test and (
        normalized.startswith(_JWT_TEST_ONLY_PREFIXES)
        or "not-for-production" in normalized
        or "only-for-tests" in normalized
    ):
        raise ValueError(
            "Test-only JWT signing secrets are forbidden outside the test environment."
        )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="FITMAP_",
        extra="ignore",
        hide_input_in_errors=True,
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
    auth_rate_limit_secret: SecretStr | None = None
    auth_email_verification_enabled: bool = False
    auth_password_recovery_enabled: bool = False
    email_worker_enabled: bool = False
    email_trial_enabled: bool = False
    email_trial_recipient: EmailStr | None = None

    @model_validator(mode="after")
    def _validate_jwt_secret_policy(self) -> Self:
        jwt_secret = self.auth_jwt_secret.get_secret_value()

        _validate_jwt_secret_value(
            jwt_secret,
            is_test=self.environment == "test",
        )

        independent_secrets = (
            self.auth_rate_limit_secret,
            self.auth_recovery_code_secret,
            self.auth_email_verification_secret,
            self.email_outbox_encryption_key,
        )

        for secret in independent_secrets:
            if secret is not None and secret.get_secret_value() == jwt_secret:
                raise ValueError(
                    "JWT signing secret must be independent from other cryptographic secrets."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
