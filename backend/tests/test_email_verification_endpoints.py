"""HTTP verification boundary tests: authenticated owner, durable counters, no delivery."""

import hmac
from collections.abc import Iterator
from datetime import UTC, datetime
from hashlib import sha256
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import User
from fitmap.identity.verification_models import EmailVerificationChallenge
from fitmap.main import create_app
from fitmap.notifications.outbox import decrypt_outbox_email
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.security.rate_limit_models import AuthRateLimitBucket

ISSUE_PATH = "/api/v1/auth/email-verification/request"
CONFIRM_PATH = "/api/v1/auth/email-verification/confirm"
Scenario = tuple[TestClient, Settings, list[str]]


@pytest.fixture
def scenario(database_engine: Engine, test_settings: Settings) -> Iterator[Scenario]:
    """Account fixtures and rate-limit inserts are cleaned up, even after failure."""
    emails: list[str] = []
    with database_engine.connect() as connection:
        existing_rate_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())
    settings = test_settings.model_copy(
        update={
            "auth_email_verification_enabled": True,
            "auth_email_verification_secret": SecretStr(
                f"test-verification-{uuid4()}-isolated-secret"
            ),
            "auth_rate_limit_secret": SecretStr(f"test-limits-{uuid4()}-isolated-secret"),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )
    try:
        with TestClient(create_app(settings), client=("198.51.100.21", 50000)) as api_client:
            yield api_client, settings, emails
    finally:
        with database_engine.begin() as connection:
            if emails:
                connection.execute(delete(User).where(User.email.in_(emails)))
            current_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())
            new_keys = current_keys - existing_rate_keys
            if new_keys:
                connection.execute(
                    delete(AuthRateLimitBucket).where(AuthRateLimitBucket.key_hash.in_(new_keys))
                )


def register(scenario: Scenario) -> tuple[str, str]:
    api_client, _settings, emails = scenario
    email = f"http-verification-{uuid4()}@example.com"
    emails.append(email)
    registered = api_client.post(
        "/api/v1/auth/register",
        json={"name": "Verification API User", "email": email, "password": "SafePassword1!"},
    )
    assert registered.status_code == 201
    data = registered.json()
    return str(data["user"]["id"]), str(data["tokens"]["access_token"])


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def read_code(database_engine: Engine, user_id: str, settings: Settings) -> str:
    with Session(database_engine) as db_session:
        outbox = db_session.scalar(
            select(EmailOutboxMessage)
            .where(EmailOutboxMessage.user_id == UUID(user_id))
            .order_by(EmailOutboxMessage.created_at.desc())
        )
        assert outbox is not None
        assert outbox.status == "pending"
        message = decrypt_outbox_email(row=outbox, settings=settings, now=datetime.now(UTC))
        code = next(
            line.removeprefix("Código de verificação: ")
            for line in message.text_body.splitlines()
            if line.startswith("Código de verificação: ")
        )
        assert code.encode() not in outbox.encrypted_payload
        assert message.recipient.encode() not in outbox.encrypted_payload
        return code


@pytest.mark.usefixtures("cleanup_auth_rate_limit_buckets")
def test_disabled_by_default_even_with_valid_login(
    database_engine: Engine, test_settings: Settings
) -> None:
    email = f"disabled-verification-{uuid4()}@example.com"
    try:
        with TestClient(
            create_app(test_settings),
            client=("198.51.100.21", 50000),
        ) as api_client:
            registered = api_client.post(
                "/api/v1/auth/register",
                json={"name": "Disabled Test", "email": email, "password": "SafePassword1!"},
            )
            assert registered.status_code == 201
            token = str(registered.json()["tokens"]["access_token"])
            result = api_client.post(ISSUE_PATH, headers=headers(token))
            assert result.status_code == 503
            assert result.json()["error"]["code"] == "email_verification_unavailable"
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email == email))


def test_request_and_confirm_require_valid_access_token(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    for path, payload in ((ISSUE_PATH, None), (CONFIRM_PATH, {"code": "123456"})):
        result = api_client.post(path, json=payload)
        assert result.status_code == 401
        assert result.json()["error"]["code"] == "invalid_access_token"


def test_request_stages_encrypted_email_and_verification_succeeds(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    user_id, token = register(scenario)
    response = api_client.post(ISSUE_PATH, headers=headers(token))
    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}
    assert response.headers["cache-control"] == "no-store"
    assert "code" not in response.text.lower()
    code = read_code(database_engine, user_id, settings)
    verified = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": code})
    assert verified.status_code == 200
    assert verified.json() == {"status": "verified"}
    assert verified.headers["cache-control"] == "no-store"
    replay = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": code})
    assert replay.status_code == 200
    assert replay.json() == {"status": "already_verified"}
    with database_engine.connect() as connection:
        assert (
            connection.scalar(select(User.email_verified_at).where(User.id == UUID(user_id)))
            is not None
        )


def test_cooldown_and_already_verified_reply_uniformly(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    user_id, token = register(scenario)
    assert api_client.post(ISSUE_PATH, headers=headers(token)).status_code == 202
    assert api_client.post(ISSUE_PATH, headers=headers(token)).json() == {"status": "accepted"}
    with database_engine.connect() as connection:
        assert (
            len(
                connection.execute(
                    select(EmailOutboxMessage.id).where(EmailOutboxMessage.user_id == UUID(user_id))
                ).all()
            )
            == 1
        )
    code = read_code(database_engine, user_id, settings)
    assert (
        api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": code}).status_code
        == 200
    )
    result = api_client.post(ISSUE_PATH, headers=headers(token))
    assert result.status_code == 202
    assert result.json() == {"status": "accepted"}


def test_wrong_code_attempt_is_committed(scenario: Scenario, database_engine: Engine) -> None:
    api_client, settings, _emails = scenario
    user_id, token = register(scenario)
    assert api_client.post(ISSUE_PATH, headers=headers(token)).status_code == 202
    real_code = read_code(database_engine, user_id, settings)
    wrong_code = f"{(int(real_code) + 1) % 1_000_000:06d}"
    invalid = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": wrong_code})
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "invalid_verification_code"
    with database_engine.connect() as connection:
        assert (
            connection.scalar(
                select(EmailVerificationChallenge.attempt_count).where(
                    EmailVerificationChallenge.user_id == UUID(user_id)
                )
            )
            == 1
        )


def test_code_is_bound_to_authenticated_account(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    user_a, token_a = register(scenario)
    _user_b, token_b = register(scenario)
    assert api_client.post(ISSUE_PATH, headers=headers(token_a)).status_code == 202
    code = read_code(database_engine, user_a, settings)
    misuse = api_client.post(CONFIRM_PATH, headers=headers(token_b), json={"code": code})
    assert misuse.status_code == 400
    assert misuse.json()["error"]["code"] == "invalid_verification_code"
    correct = api_client.post(CONFIRM_PATH, headers=headers(token_a), json={"code": code})
    assert correct.status_code == 200


def test_network_and_identity_limits_persist_after_denial(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    _user_id, token = register(scenario)
    for _ in range(5):
        response = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": "000000"})
        assert response.status_code == 400
    denied = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": "000000"})
    assert denied.status_code == 429
    repeated = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": "000000"})
    assert repeated.status_code == 429
    assert repeated.json()["error"]["code"] == "auth_rate_limited"


def test_forwarded_ip_headers_are_not_trusted(scenario: Scenario, database_engine: Engine) -> None:
    api_client, settings, _emails = scenario
    _user_id, token = register(scenario)
    for spoofed in ("10.0.0.1", "10.0.0.2"):
        response = api_client.post(
            ISSUE_PATH,
            headers={**headers(token), "X-Forwarded-For": spoofed},
        )
        assert response.status_code == 202
    secret = settings.auth_rate_limit_secret
    assert secret is not None
    key = hmac.new(
        secret.get_secret_value().encode(),
        b"fitmap-auth-rate:v1:email_verification_issue:ip:198.51.100.21",
        sha256,
    ).hexdigest()
    with database_engine.connect() as connection:
        count = connection.scalar(
            select(AuthRateLimitBucket.request_count).where(AuthRateLimitBucket.key_hash == key)
        )
        assert count == 2


@pytest.mark.parametrize(
    "code", ["12345", "1234567", "ABCDEF", "\uff11\uff12\uff13\uff14\uff15\uff16", "123 56"]
)
def test_confirmation_rejects_non_ascii_or_malformed_codes(scenario: Scenario, code: str) -> None:
    api_client, _settings, _emails = scenario
    _user_id, token = register(scenario)
    response = api_client.post(CONFIRM_PATH, headers=headers(token), json={"code": code})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"
