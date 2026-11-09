"""Gated recovery HTTP tests: enumeration resistance, durable abuse limits, revocation."""

import hmac
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import sha256
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, delete, select, update
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.recovery_models import PasswordRecoveryChallenge
from fitmap.identity.security import verify_password
from fitmap.main import create_app
from fitmap.notifications.outbox import decrypt_outbox_email
from fitmap.notifications.outbox_models import EmailOutboxMessage
from fitmap.security.rate_limit_models import AuthRateLimitBucket

REQUEST_PATH = "/api/v1/auth/password-recovery/request"
RESET_PATH = "/api/v1/auth/password-recovery/reset"
OLD_PASSWORD = "OldPassword1!"
NEW_PASSWORD = "NewPassword2!"
Scenario = tuple[TestClient, Settings, list[str]]


@pytest.fixture
def scenario(database_engine: Engine, test_settings: Settings) -> Iterator[Scenario]:
    """Delete only this scenario's accounts and counter keys, even after errors."""
    emails: list[str] = []
    with database_engine.connect() as connection:
        existing_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())
    settings = test_settings.model_copy(
        update={
            "auth_password_recovery_enabled": True,
            "auth_recovery_code_secret": SecretStr(f"recovery-test-{uuid4()}-independent-secret"),
            "auth_rate_limit_secret": SecretStr(f"limit-test-{uuid4()}-independent-secret"),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )
    try:
        with TestClient(create_app(settings), client=("198.51.100.30", 50000)) as api_client:
            yield api_client, settings, emails
    finally:
        with database_engine.begin() as connection:
            if emails:
                connection.execute(delete(User).where(User.email.in_(emails)))
            new_keys = (
                set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all()) - existing_keys
            )
            if new_keys:
                connection.execute(
                    delete(AuthRateLimitBucket).where(AuthRateLimitBucket.key_hash.in_(new_keys))
                )


def register(scenario: Scenario) -> tuple[str, str, str, str]:
    api_client, _settings, emails = scenario
    email = f"http-recovery-{uuid4()}@example.com"
    emails.append(email)
    result = api_client.post(
        "/api/v1/auth/register",
        json={"name": "Recovery User", "email": email, "password": OLD_PASSWORD},
    )
    assert result.status_code == 201
    payload = result.json()
    return (
        email,
        str(payload["user"]["id"]),
        str(payload["tokens"]["access_token"]),
        str(payload["tokens"]["refresh_token"]),
    )


def mark_verified(database_engine: Engine, user_id: str) -> None:
    with database_engine.begin() as connection:
        connection.execute(
            update(User).where(User.id == UUID(user_id)).values(email_verified_at=datetime.now(UTC))
        )


def get_code(database_engine: Engine, user_id: str, settings: Settings) -> str:
    with Session(database_engine) as db_session:
        outbox = db_session.scalar(
            select(EmailOutboxMessage)
            .where(
                EmailOutboxMessage.user_id == UUID(user_id),
                EmailOutboxMessage.purpose == "password_recovery",
            )
            .order_by(EmailOutboxMessage.created_at.desc())
        )
        assert outbox is not None and outbox.status == "pending"
        message = decrypt_outbox_email(row=outbox, settings=settings, now=datetime.now(UTC))
        assert message.recipient.encode() not in outbox.encrypted_payload
        code = next(
            line.removeprefix("Seu código de recuperação: ")
            for line in message.text_body.splitlines()
            if line.startswith("Seu código de recuperação: ")
        )
        assert code.encode() not in outbox.encrypted_payload
        return code


def reset_payload(email: str, code: str, password: str = NEW_PASSWORD) -> dict[str, str]:
    return {
        "email": email,
        "code": code,
        "password": password,
        "confirm_password": password,
    }


def test_disabled_by_default(test_settings: Settings, database_engine: Engine) -> None:
    email = f"disabled-recovery-{uuid4()}@example.com"
    try:
        with TestClient(create_app(test_settings)) as api_client:
            registered = api_client.post(
                "/api/v1/auth/register",
                json={"name": "Disabled", "email": email, "password": OLD_PASSWORD},
            )
            assert registered.status_code == 201
            for path, payload in (
                (REQUEST_PATH, {"email": email}),
                (RESET_PATH, reset_payload(email, "123456")),
            ):
                response = api_client.post(path, json=payload)
                assert response.status_code == 503
                assert response.json()["error"]["code"] == "password_recovery_unavailable"
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email == email))


def test_missing_secrets_fail_closed(test_settings: Settings) -> None:
    settings = test_settings.model_copy(update={"auth_password_recovery_enabled": True})
    with TestClient(create_app(settings), client=("198.51.100.32", 50000)) as api_client:
        result = api_client.post(REQUEST_PATH, json={"email": "unknown@example.com"})
        assert result.status_code == 503


def test_reused_authentication_secret_is_rejected(scenario: Scenario) -> None:
    _api_client, settings, _emails = scenario
    unsafe = settings.model_copy(
        update={"auth_rate_limit_secret": settings.auth_recovery_code_secret}
    )
    with TestClient(create_app(unsafe), client=("198.51.100.34", 50000)) as api_client:
        result = api_client.post(REQUEST_PATH, json={"email": "unknown@example.com"})
        assert result.status_code == 503


def test_non_test_environment_requires_delivery_provider(scenario: Scenario) -> None:
    _api_client, settings, _emails = scenario
    unsupported = settings.model_copy(update={"environment": "development"})
    with TestClient(create_app(unsupported), client=("198.51.100.33", 50000)) as api_client:
        result = api_client.post(REQUEST_PATH, json={"email": "unknown@example.com"})
        assert result.status_code == 503


def test_invalid_asgi_peer_is_rejected(scenario: Scenario) -> None:
    _api_client, settings, _emails = scenario
    with TestClient(create_app(settings)) as api_client:
        result = api_client.post(REQUEST_PATH, json={"email": "unknown@example.com"})
        assert result.status_code == 503


def test_request_is_public_and_unknown_address_gets_uniform_202(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    result = api_client.post(REQUEST_PATH, json={"email": f"missing-{uuid4()}@example.com"})
    assert result.status_code == 202
    assert result.json() == {"status": "accepted"}
    assert result.headers["cache-control"] == "no-store"
    assert "code" not in result.text.lower()


def test_known_unverified_and_inactive_accounts_have_same_response(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, _settings, _emails = scenario
    unverified, unverified_id, _access, _refresh = register(scenario)
    inactive, inactive_id, _access_2, _refresh_2 = register(scenario)
    with database_engine.begin() as connection:
        connection.execute(update(User).where(User.id == UUID(inactive_id)).values(is_active=False))
    for email in (unverified, inactive, f"absent-{uuid4()}@example.com"):
        result = api_client.post(REQUEST_PATH, json={"email": email})
        assert result.status_code == 202
        assert result.json() == {"status": "accepted"}
    with database_engine.connect() as connection:
        assert (
            connection.scalar(
                select(EmailOutboxMessage.id).where(
                    EmailOutboxMessage.user_id.in_([UUID(unverified_id), UUID(inactive_id)])
                )
            )
            is None
        )


def test_verified_account_gets_encrypted_code_without_network_send(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    result = api_client.post(REQUEST_PATH, json={"email": email.upper()})
    assert result.status_code == 202
    assert result.json() == {"status": "accepted"}
    assert result.headers["cache-control"] == "no-store"
    code = get_code(database_engine, user_id, settings)
    assert len(code) == 6 and code.isascii() and code.isdecimal()
    with database_engine.connect() as connection:
        challenge = connection.scalar(
            select(PasswordRecoveryChallenge.code_hash).where(
                PasswordRecoveryChallenge.user_id == UUID(user_id)
            )
        )
        assert challenge is not None and challenge != code


def test_cooldown_and_identifier_limit_keep_uniform_202(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, _settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    for _ in range(5):
        result = api_client.post(REQUEST_PATH, json={"email": email})
        assert result.status_code == 202
        assert result.json() == {"status": "accepted"}
    with database_engine.connect() as connection:
        assert (
            len(
                connection.execute(
                    select(EmailOutboxMessage.id).where(EmailOutboxMessage.user_id == UUID(user_id))
                ).all()
            )
            == 1
        )


def test_ip_limit_counts_even_when_account_does_not_exist(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    for _ in range(9):
        result = api_client.post(REQUEST_PATH, json={"email": f"random-{uuid4()}@example.com"})
        assert result.status_code == 202
    key = settings.auth_rate_limit_secret
    assert key is not None
    digest = hmac.new(
        key.get_secret_value().encode(),
        b"fitmap-auth-rate:v1:password_recovery_request:ip:198.51.100.30",
        sha256,
    ).hexdigest()
    with database_engine.connect() as connection:
        count = connection.scalar(
            select(AuthRateLimitBucket.request_count).where(AuthRateLimitBucket.key_hash == digest)
        )
        assert count == 9  # 8 permitted, 9th counted and capped.


def test_forwarded_ip_headers_are_ignored(scenario: Scenario, database_engine: Engine) -> None:
    api_client, settings, _emails = scenario
    for spoofed in ("192.0.2.10", "192.0.2.11"):
        result = api_client.post(
            REQUEST_PATH,
            json={"email": f"missing-{uuid4()}@example.com"},
            headers={"X-Forwarded-For": spoofed, "X-Real-IP": spoofed},
        )
        assert result.status_code == 202
    secret = settings.auth_rate_limit_secret
    assert secret is not None
    ip_key = hmac.new(
        secret.get_secret_value().encode(),
        b"fitmap-auth-rate:v1:password_recovery_request:ip:198.51.100.30",
        sha256,
    ).hexdigest()
    with database_engine.connect() as connection:
        assert (
            connection.scalar(
                select(AuthRateLimitBucket.request_count).where(
                    AuthRateLimitBucket.key_hash == ip_key
                )
            )
            == 2
        )


def test_reset_with_missing_account_returns_generic_invalid(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    result = api_client.post(
        RESET_PATH, json=reset_payload(f"nobody-{uuid4()}@example.com", "123456")
    )
    assert result.status_code == 400
    assert result.json()["error"]["code"] == "invalid_recovery_code"


def test_unverified_account_cannot_reset(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    email, _user_id, _access, _refresh = register(scenario)
    result = api_client.post(RESET_PATH, json=reset_payload(email, "123456"))
    assert result.status_code == 400
    assert result.json()["error"]["code"] == "invalid_recovery_code"


def test_wrong_code_increments_persisted_attempts(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    assert api_client.post(REQUEST_PATH, json={"email": email}).status_code == 202
    code = get_code(database_engine, user_id, settings)
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    result = api_client.post(RESET_PATH, json=reset_payload(email, wrong))
    assert result.status_code == 400
    assert result.json()["error"]["code"] == "invalid_recovery_code"
    with database_engine.connect() as connection:
        assert (
            connection.scalar(
                select(PasswordRecoveryChallenge.attempt_count).where(
                    PasswordRecoveryChallenge.user_id == UUID(user_id)
                )
            )
            == 1
        )


def test_five_wrong_codes_consume_challenge_and_later_attempt_is_throttled(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    api_client.post(REQUEST_PATH, json={"email": email})
    code = get_code(database_engine, user_id, settings)
    for index in range(5):
        wrong = f"{(int(code) + index + 1) % 1_000_000:06d}"
        response = api_client.post(RESET_PATH, json=reset_payload(email, wrong))
        assert response.status_code == 400
    with database_engine.connect() as connection:
        attempt_count, consumed_at = connection.execute(
            select(
                PasswordRecoveryChallenge.attempt_count,
                PasswordRecoveryChallenge.consumed_at,
            ).where(PasswordRecoveryChallenge.user_id == UUID(user_id))
        ).one()
        assert attempt_count == 5 and consumed_at is not None
    denied = api_client.post(RESET_PATH, json=reset_payload(email, code))
    assert denied.status_code == 429
    assert denied.json()["error"]["code"] == "auth_rate_limited"


def test_identifier_rate_limit_persists_for_nonexistent_account(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    email = f"missing-{uuid4()}@example.com"
    for _ in range(5):
        response = api_client.post(RESET_PATH, json=reset_payload(email, "123456"))
        assert response.status_code == 400
    for _ in range(2):
        denied = api_client.post(RESET_PATH, json=reset_payload(email, "123456"))
        assert denied.status_code == 429
        assert denied.json()["error"]["code"] == "auth_rate_limited"


def test_valid_reset_revokes_all_sessions_and_avoids_auto_login(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, old_access, old_refresh = register(scenario)
    mark_verified(database_engine, user_id)
    another_session = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": OLD_PASSWORD}
    )
    assert another_session.status_code == 200
    second_access = str(another_session.json()["tokens"]["access_token"])
    second_refresh = str(another_session.json()["tokens"]["refresh_token"])
    assert api_client.post(REQUEST_PATH, json={"email": email}).status_code == 202
    code = get_code(database_engine, user_id, settings)
    result = api_client.post(RESET_PATH, json=reset_payload(email, code))
    assert result.status_code == 200
    assert result.json() == {"status": "reset"}
    assert result.headers["cache-control"] == "no-store"
    for token in (old_access, second_access):
        current = api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert current.status_code == 401
    for token in (old_refresh, second_refresh):
        refreshed = api_client.post("/api/v1/auth/refresh", json={"refresh_token": token})
        assert refreshed.status_code == 401
    with database_engine.connect() as connection:
        sessions = (
            connection.execute(
                select(AuthSession.revoked_at).where(AuthSession.user_id == UUID(user_id))
            )
            .scalars()
            .all()
        )
        assert len(sessions) == 2 and all(value is not None for value in sessions)
        tokens = (
            connection.execute(
                select(AuthRefreshToken.revoked_at).where(
                    AuthRefreshToken.session_id.in_(
                        select(AuthSession.id).where(AuthSession.user_id == UUID(user_id))
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(tokens) == 2 and all(value is not None for value in tokens)
    old_login = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": OLD_PASSWORD}
    )
    assert old_login.status_code == 401
    new_login = api_client.post(
        "/api/v1/auth/login", json={"email": email, "password": NEW_PASSWORD}
    )
    assert new_login.status_code == 200


def test_replay_of_successfully_used_code_is_invalid(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    api_client.post(REQUEST_PATH, json={"email": email})
    code = get_code(database_engine, user_id, settings)
    first = api_client.post(RESET_PATH, json=reset_payload(email, code))
    assert first.status_code == 200
    replay = api_client.post(RESET_PATH, json=reset_payload(email, code, "SecondGood2!"))
    assert replay.status_code == 400
    with database_engine.connect() as connection:
        stored_hash = connection.scalar(select(User.password_hash).where(User.id == UUID(user_id)))
        assert stored_hash is not None and verify_password(NEW_PASSWORD, stored_hash)


def test_concurrent_reset_consumes_code_only_once(
    scenario: Scenario, database_engine: Engine
) -> None:
    api_client, settings, _emails = scenario
    email, user_id, _access, _refresh = register(scenario)
    mark_verified(database_engine, user_id)
    api_client.post(REQUEST_PATH, json={"email": email})
    code = get_code(database_engine, user_id, settings)

    def attempt(_index: int) -> int:
        with TestClient(create_app(settings), client=("198.51.100.39", 50000)) as other_client:
            return other_client.post(RESET_PATH, json=reset_payload(email, code)).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = sorted(pool.map(attempt, range(2)))
    assert statuses == [200, 400]


@pytest.mark.parametrize(
    "code", ["12345", "1234567", "ABCDEF", "\uff11\uff12\uff13\uff14\uff15\uff16", "123 56"]
)
def test_malformed_code_is_rejected_before_reset(scenario: Scenario, code: str) -> None:
    api_client, _settings, _emails = scenario
    response = api_client.post(RESET_PATH, json=reset_payload("valid@example.com", code))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_error"


@pytest.mark.parametrize("password", ["short", "lowercase1!", "NoDigitHere!", "NoSymbol123"])
def test_password_policy_is_enforced_by_http_validation(scenario: Scenario, password: str) -> None:
    api_client, _settings, _emails = scenario
    response = api_client.post(
        RESET_PATH, json=reset_payload("valid@example.com", "123456", password)
    )
    assert response.status_code == 422


def test_password_confirmation_mismatch_rejected(scenario: Scenario) -> None:
    api_client, _settings, _emails = scenario
    payload = reset_payload("valid@example.com", "123456")
    payload["confirm_password"] = "DifferentPassword1!"
    response = api_client.post(RESET_PATH, json=payload)
    assert response.status_code == 422
