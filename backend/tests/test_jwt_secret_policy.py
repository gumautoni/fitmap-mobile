from secrets import token_urlsafe
from string import ascii_letters
from typing import Literal

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr, ValidationError
from pydantic_settings import SettingsConfigDict

from fitmap.config import Settings

type Environment = Literal["development", "test", "staging", "production"]


class _IsolatedSettings(Settings):
    model_config = SettingsConfigDict(env_file=None)


def _settings(
    environment: Environment,
    jwt_secret: str,
    *,
    reused_field: str | None = None,
) -> Settings:
    secret = SecretStr(jwt_secret)

    return _IsolatedSettings(
        environment=environment,
        db_password=SecretStr("synthetic-database-password"),
        auth_jwt_secret=secret,
        auth_rate_limit_secret=(secret if reused_field == "auth_rate_limit_secret" else None),
        auth_recovery_code_secret=(secret if reused_field == "auth_recovery_code_secret" else None),
        auth_email_verification_secret=(
            secret if reused_field == "auth_email_verification_secret" else None
        ),
        email_outbox_encryption_key=(
            secret if reused_field == "email_outbox_encryption_key" else None
        ),
    )


@pytest.mark.parametrize(
    "environment",
    ["development", "test", "staging", "production"],
)
def test_accepts_independent_random_jwt_secret(
    environment: Environment,
) -> None:
    secret = token_urlsafe(48)

    settings = _settings(environment, secret)

    assert settings.auth_jwt_secret.get_secret_value() == secret
    assert settings.auth_jwt_algorithm == "HS256"
    assert secret not in repr(settings)


@pytest.mark.parametrize(
    "environment",
    ["development", "test", "staging", "production"],
)
@pytest.mark.parametrize(
    "secret",
    [
        "",
        "short-secret",
        " " * 48,
        " " + "synthetic-key-9Kx72mUq8cFj5Rp3VnY",
        "synthetic-key-9Kx72mUq\n8cFj5Rp3VnY",
        "replace-with-a-strong-random-secret",
        "change-me-this-is-not-a-random-jwt-secret",
        "a" * 48,
        "ab" * 24,
        "0123456789abcdef" * 3,
    ],
    ids=[
        "empty",
        "short",
        "blank",
        "surrounding-whitespace",
        "embedded-newline",
        "example-placeholder",
        "change-me-placeholder",
        "repeated-character",
        "repeated-pair",
        "repeated-sequence",
    ],
)
def test_rejects_weak_jwt_secret(
    environment: Environment,
    secret: str,
) -> None:
    with pytest.raises(ValidationError):
        _settings(environment, secret)


@pytest.mark.parametrize(
    ("environment", "secret"),
    [
        (
            "development",
            "fitmap-test-only-jwt-secret-not-for-production-use",
        ),
        (
            "staging",
            "fitmap-test-only-jwt-secret-not-for-production-use",
        ),
        (
            "production",
            "fitmap-test-only-jwt-secret-not-for-production-use",
        ),
        (
            "production",
            "ci-test-only-jwt-secret-not-for-production-use",
        ),
    ],
    ids=[
        "development-test-key",
        "staging-test-key",
        "production-test-key",
        "production-ci-key",
    ],
)
def test_rejects_test_only_secret_outside_tests(
    environment: Environment,
    secret: str,
) -> None:
    with pytest.raises(ValidationError):
        _settings(environment, secret)


def test_preserves_existing_test_only_fixture() -> None:
    secret = "fitmap-test-only-jwt-secret-not-for-production-use"

    settings = _settings("test", secret)

    assert settings.auth_jwt_secret.get_secret_value() == secret


@pytest.mark.parametrize(
    "environment",
    ["development", "test", "staging", "production"],
)
@pytest.mark.parametrize(
    "field",
    [
        "auth_rate_limit_secret",
        "auth_recovery_code_secret",
        "auth_email_verification_secret",
        "email_outbox_encryption_key",
    ],
)
def test_rejects_jwt_secret_reuse(
    environment: Environment,
    field: str,
) -> None:
    with pytest.raises(ValidationError):
        _settings(
            environment,
            token_urlsafe(48),
            reused_field=field,
        )


def test_jwt_secret_remains_required(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FITMAP_AUTH_JWT_SECRET", raising=False)

    with pytest.raises(ValidationError):
        _IsolatedSettings(
            environment="production",
            db_password=SecretStr("synthetic-database-password"),
            auth_rate_limit_secret=None,
            auth_recovery_code_secret=None,
            auth_email_verification_secret=None,
            email_outbox_encryption_key=None,
        )  # pyright: ignore[reportCallIssue]


def test_validation_error_does_not_display_secret_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    jwt_secret = token_urlsafe(48)
    db_secret = token_urlsafe(32)

    monkeypatch.setenv("FITMAP_AUTH_JWT_SECRET", jwt_secret)
    monkeypatch.setenv("FITMAP_DB_PASSWORD", db_secret)
    monkeypatch.setenv("FITMAP_AUTH_RATE_LIMIT_SECRET", jwt_secret)

    with pytest.raises(ValidationError) as captured:
        _IsolatedSettings(
            environment="production",
            auth_recovery_code_secret=None,
            auth_email_verification_secret=None,
            email_outbox_encryption_key=None,
        )  # pyright: ignore[reportCallIssue]

    message = str(captured.value)

    assert jwt_secret not in message
    assert db_secret not in message


@pytest.mark.parametrize("length", [31, 32])
def test_hs256_minimum_byte_boundary(length: int) -> None:
    # Synthetic material used only to verify the length boundary.
    secret = ascii_letters[:length]

    assert len(secret.encode("utf-8")) == length

    if length == 31:
        with pytest.raises(ValidationError, match="at least 32"):
            _settings("production", secret)
    else:
        settings = _settings("production", secret)

        assert settings.auth_jwt_secret.get_secret_value() == secret


@pytest.mark.parametrize(
    "character",
    [" ", "\t", "\n", "\x00"],
    ids=["space", "tab", "newline", "null"],
)
def test_rejects_whitespace_and_controls_in_long_secret(
    character: str,
) -> None:
    secret = token_urlsafe(48)
    invalid = secret[:16] + character + secret[16:]

    assert len(invalid.encode("utf-8")) >= 32

    with pytest.raises(
        ValidationError,
        match="whitespace or control characters",
    ):
        _settings("production", invalid)


def test_accepts_independent_configured_cryptographic_secrets() -> None:
    settings = _IsolatedSettings(
        environment="production",
        db_password=SecretStr(token_urlsafe(32)),
        auth_jwt_secret=SecretStr(token_urlsafe(48)),
        auth_rate_limit_secret=SecretStr(token_urlsafe(48)),
        auth_recovery_code_secret=SecretStr(token_urlsafe(48)),
        auth_email_verification_secret=SecretStr(token_urlsafe(48)),
        email_outbox_encryption_key=SecretStr(Fernet.generate_key().decode()),
    )

    assert settings.auth_jwt_algorithm == "HS256"
    assert settings.auth_rate_limit_secret is not None
    assert settings.auth_recovery_code_secret is not None
    assert settings.auth_email_verification_secret is not None
    assert settings.email_outbox_encryption_key is not None


def test_invalid_environment_secret_is_not_exposed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalid = "replace-with-" + token_urlsafe(48)
    db_secret = token_urlsafe(32)

    monkeypatch.setenv("FITMAP_AUTH_JWT_SECRET", invalid)
    monkeypatch.setenv("FITMAP_DB_PASSWORD", db_secret)

    with pytest.raises(ValidationError, match="placeholder") as captured:
        _IsolatedSettings(
            environment="production",
            auth_rate_limit_secret=None,
            auth_recovery_code_secret=None,
            auth_email_verification_secret=None,
            email_outbox_encryption_key=None,
        )  # pyright: ignore[reportCallIssue]

    message = str(captured.value)

    assert invalid not in message
    assert db_secret not in message
