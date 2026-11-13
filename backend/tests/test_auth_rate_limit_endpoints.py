from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from fitmap.api import auth as auth_api
from fitmap.config import Settings
from fitmap.identity.models import AuthSession, User
from fitmap.main import create_app
from fitmap.security.rate_limit_models import AuthRateLimitBucket


@pytest.fixture
def rate_limit_email() -> str:
    return f"rate-limit-{uuid4()}@example.com"


@pytest.fixture
def rate_limit_client(
    test_settings: Settings,
    database_engine: Engine,
    rate_limit_email: str,
) -> Iterator[TestClient]:
    settings = test_settings.model_copy(
        update={
            "auth_rate_limit_secret": SecretStr(token_urlsafe(48)),
        },
    )

    with database_engine.connect() as connection:
        existing_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())

    application = create_app(settings)

    try:
        with TestClient(
            application,
            client=("198.51.100.10", 50000),
        ) as test_client:
            yield test_client
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email == rate_limit_email))

            all_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())

            new_keys = all_keys - existing_keys

            if new_keys:
                connection.execute(
                    delete(AuthRateLimitBucket).where(AuthRateLimitBucket.key_hash.in_(new_keys))
                )


def test_login_rejects_attempts_above_identity_limit(
    rate_limit_client: TestClient,
    rate_limit_email: str,
) -> None:
    payload = {
        "email": rate_limit_email,
        "password": "incorrect-password",
    }

    for _ in range(5):
        response = rate_limit_client.post(
            "/api/v1/auth/login",
            json=payload,
        )

        assert response.status_code == 401
        assert response.json()["error"]["code"] == "invalid_credentials"

    response = rate_limit_client.post(
        "/api/v1/auth/login",
        json={
            **payload,
            "email": rate_limit_email.upper(),
        },
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limit_exceeded"
    assert 1 <= int(response.headers["retry-after"]) <= 900


def test_register_rejects_attempts_above_identity_limit(
    rate_limit_client: TestClient,
    rate_limit_email: str,
) -> None:
    payload = {
        "name": "Rate Limit Test User",
        "email": rate_limit_email,
        "password": "Aa1!bcde",
    }

    response = rate_limit_client.post(
        "/api/v1/auth/register",
        json=payload,
    )

    assert response.status_code == 201

    for _ in range(2):
        response = rate_limit_client.post(
            "/api/v1/auth/register",
            json=payload,
        )

        assert response.status_code == 409

    response = rate_limit_client.post(
        "/api/v1/auth/register",
        json={
            **payload,
            "email": rate_limit_email.upper(),
        },
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limit_exceeded"
    assert 1 <= int(response.headers["retry-after"]) <= 3600


def authentication_payload(action: str, email: str) -> dict[str, str]:
    if action == "register":
        return {
            "name": "Rate Limit Test User",
            "email": email,
            "password": "Aa1!bcde",
        }

    return {
        "email": email,
        "password": "incorrect-password",
    }


@pytest.mark.parametrize(
    ("action", "maximum", "allowed_status", "window"),
    [
        ("login", 30, 401, 900),
        ("register", 10, 201, 3600),
    ],
)
def test_network_limit_ignores_forwarded_headers(
    rate_limit_client: TestClient,
    database_engine: Engine,
    action: str,
    maximum: int,
    allowed_status: int,
    window: int,
) -> None:
    emails = [f"network-limit-{uuid4()}@example.com" for _ in range(maximum + 1)]

    try:
        for index, email in enumerate(emails):
            response = rate_limit_client.post(
                f"/api/v1/auth/{action}",
                json=authentication_payload(action, email),
                headers={
                    "X-Forwarded-For": f"203.0.113.{index + 1}",
                    "X-Real-IP": f"192.0.2.{index + 1}",
                },
            )

            if index < maximum:
                assert response.status_code == allowed_status
            else:
                assert response.status_code == 429
                assert response.json()["error"]["code"] == "rate_limit_exceeded"
                assert 1 <= int(response.headers["retry-after"]) <= window
                assert response.headers["cache-control"] == "no-store"

        if action == "register":
            with database_engine.connect() as connection:
                blocked_user = connection.scalar(select(User.id).where(User.email == emails[-1]))

            assert blocked_user is None
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email.in_(emails)))


def test_correct_password_does_not_bypass_active_limit(
    rate_limit_client: TestClient,
    rate_limit_email: str,
    database_engine: Engine,
) -> None:
    registered = rate_limit_client.post(
        "/api/v1/auth/register",
        json=authentication_payload("register", rate_limit_email),
    )
    assert registered.status_code == 201

    for _ in range(5):
        response = rate_limit_client.post(
            "/api/v1/auth/login",
            json=authentication_payload("login", rate_limit_email),
        )
        assert response.status_code == 401

    denied = rate_limit_client.post(
        "/api/v1/auth/login",
        json={
            "email": rate_limit_email,
            "password": "Aa1!bcde",
        },
    )

    assert denied.status_code == 429
    assert denied.json()["error"]["code"] == "rate_limit_exceeded"
    assert denied.headers["cache-control"] == "no-store"
    assert "tokens" not in denied.json()

    with database_engine.connect() as connection:
        session_count = connection.scalar(
            select(func.count())
            .select_from(AuthSession)
            .join(User, User.id == AuthSession.user_id)
            .where(User.email == rate_limit_email)
        )

    assert session_count == 1


@pytest.mark.parametrize("action", ["login", "register"])
@pytest.mark.parametrize(
    "mode",
    ["missing", "short", "reused", "placeholder", "blank"],
)
def test_invalid_rate_limit_secret_fails_closed(
    test_settings: Settings,
    rate_limit_email: str,
    action: str,
    mode: str,
) -> None:
    secrets: dict[str, SecretStr | None] = {
        "missing": None,
        "short": SecretStr("short"),
        "reused": test_settings.auth_jwt_secret,
        "placeholder": SecretStr("replace-with-independent-strong-random-secret"),
        "blank": SecretStr(" " * 48),
    }

    settings = test_settings.model_copy(update={"auth_rate_limit_secret": secrets[mode]})

    with TestClient(
        create_app(settings),
        client=("198.51.100.11", 50000),
    ) as api_client:
        response = api_client.post(
            f"/api/v1/auth/{action}",
            json=authentication_payload(action, rate_limit_email),
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_rate_limit_unavailable"
    assert response.headers["cache-control"] == "no-store"
    assert "tokens" not in response.json()


@pytest.mark.parametrize("action", ["login", "register"])
def test_invalid_asgi_peer_cannot_use_forwarded_ip(
    test_settings: Settings,
    rate_limit_email: str,
    action: str,
) -> None:
    with TestClient(
        create_app(test_settings),
        client=("invalid-peer", 50000),
    ) as api_client:
        response = api_client.post(
            f"/api/v1/auth/{action}",
            json=authentication_payload(action, rate_limit_email),
            headers={
                "X-Forwarded-For": "198.51.100.12",
                "X-Real-IP": "198.51.100.12",
            },
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_rate_limit_unavailable"


@pytest.mark.parametrize("action", ["login", "register"])
@pytest.mark.parametrize("failure_stage", ["consume", "commit"])
def test_rate_limit_database_failure_fails_closed(
    rate_limit_client: TestClient,
    rate_limit_email: str,
    monkeypatch: pytest.MonkeyPatch,
    database_engine: Engine,
    action: str,
    failure_stage: str,
) -> None:
    def fail_consume(**_kwargs: object) -> None:
        raise SQLAlchemyError("Simulated limiter database failure")

    def fail_commit(self: Session) -> None:
        raise SQLAlchemyError("Simulated limiter commit failure")

    def unexpected_authentication(**_kwargs: object) -> None:
        raise AssertionError("Authentication must not execute.")

    with monkeypatch.context() as patch:
        if failure_stage == "consume":
            patch.setattr(
                auth_api,
                "consume_auth_rate_limit",
                fail_consume,
            )
        else:
            patch.setattr(Session, "commit", fail_commit)

        patch.setattr(auth_api, "login_user", unexpected_authentication)
        patch.setattr(auth_api, "register_user", unexpected_authentication)

        response = rate_limit_client.post(
            f"/api/v1/auth/{action}",
            json=authentication_payload(action, rate_limit_email),
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_rate_limit_unavailable"
    assert response.headers["cache-control"] == "no-store"
    assert "Simulated" not in response.text

    with database_engine.connect() as connection:
        assert connection.scalar(select(User.id).where(User.email == rate_limit_email)) is None


@pytest.mark.usefixtures("cleanup_auth_rate_limit_buckets")
def test_parallel_login_attempts_share_identity_limit(
    test_settings: Settings,
    rate_limit_email: str,
) -> None:
    def attempt(index: int) -> int:
        with TestClient(
            create_app(test_settings),
            client=(f"198.51.100.{index + 1}", 50000),
        ) as api_client:
            response = api_client.post(
                "/api/v1/auth/login",
                json=authentication_payload(
                    "login",
                    rate_limit_email,
                ),
            )
            return response.status_code

    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(attempt, range(7)))

    assert results.count(401) == 5
    assert results.count(429) == 2
