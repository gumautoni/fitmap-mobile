from collections.abc import Iterator
from typing import cast
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete, update

from fitmap.config import Settings
from fitmap.identity import accounts
from fitmap.identity.models import User
from fitmap.main import create_app

AUTH = "/api/v1/auth"
PASSWORD = "Aa1!bcde"


@pytest.fixture
def account_email(database_engine: Engine) -> Iterator[str]:
    email = f"auth-hardening-{uuid4()}@example.com"

    try:
        yield email
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.email == email))


def _registration_payload(email: str) -> dict[str, str]:
    return {
        "name": "FitMap Security Test",
        "email": email,
        "password": PASSWORD,
    }


@pytest.mark.usefixtures("cleanup_auth_rate_limit_buckets")
def test_dummy_hash_is_initialized_before_first_login(
    test_settings: Settings,
) -> None:
    get_dummy = accounts._get_dummy_password_hash  # pyright: ignore[reportPrivateUsage]
    get_dummy.cache_clear()

    try:
        application = create_app(test_settings)

        with TestClient(
            application,
            client=("198.51.100.51", 50000),
        ) as api_client:
            initial = get_dummy.cache_info()

            assert initial.currsize == 1

            result = api_client.post(
                f"{AUTH}/login",
                json={
                    "email": f"missing-{uuid4()}@example.com",
                    "password": PASSWORD,
                },
            )

            assert result.status_code == 401

            final = get_dummy.cache_info()

            assert final.misses == initial.misses
            assert final.hits == initial.hits + 1

    finally:
        get_dummy.cache_clear()
        get_dummy()


@pytest.mark.parametrize(
    "mode",
    ["unknown", "wrong-password", "inactive"],
)
def test_login_failures_use_same_generic_uncacheable_response(
    client: TestClient,
    database_engine: Engine,
    account_email: str,
    mode: str,
) -> None:
    email = account_email
    password = PASSWORD

    if mode != "unknown":
        registered = client.post(
            f"{AUTH}/register",
            json=_registration_payload(email),
        )

        assert registered.status_code == 201

    if mode == "wrong-password":
        password = "Wrong2@password"

    if mode == "inactive":
        with database_engine.begin() as connection:
            connection.execute(update(User).where(User.email == email).values(is_active=False))

    result = client.post(
        f"{AUTH}/login",
        json={"email": email.upper(), "password": password},
    )

    assert result.status_code == 401
    assert result.json() == {
        "error": {
            "code": "invalid_credentials",
            "message": "Invalid email or password.",
        }
    }

    assert result.headers.get("cache-control") == "no-store"


@pytest.mark.parametrize(
    "action",
    ["register", "login", "refresh", "me", "logout"],
)
def test_successful_auth_responses_are_not_cacheable(
    client: TestClient,
    account_email: str,
    action: str,
) -> None:
    registered = client.post(
        f"{AUTH}/register",
        json=_registration_payload(account_email),
    )

    assert registered.status_code == 201

    tokens = cast(dict[str, str], registered.json()["tokens"])

    headers = {
        "Authorization": f"Bearer {tokens['access_token']}",
    }

    result = registered
    expected_status = 201

    if action == "login":
        result = client.post(
            f"{AUTH}/login",
            json={"email": account_email, "password": PASSWORD},
        )
        expected_status = 200

    elif action == "refresh":
        result = client.post(
            f"{AUTH}/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        expected_status = 200

    elif action == "me":
        result = client.get(f"{AUTH}/me", headers=headers)
        expected_status = 200

    elif action == "logout":
        result = client.post(f"{AUTH}/logout", headers=headers)
        expected_status = 204

    assert result.status_code == expected_status
    assert result.headers.get("cache-control") == "no-store"


@pytest.mark.parametrize(
    ("method", "path", "payload", "expected_status"),
    [
        ("POST", "/register", {}, 422),
        ("POST", "/login", {}, 422),
        ("POST", "/refresh", {}, 422),
        (
            "POST",
            "/refresh",
            {"refresh_token": "unknown-refresh-token"},
            401,
        ),
        ("GET", "/me", None, 401),
        ("POST", "/logout", None, 401),
        (
            "POST",
            "/password-recovery/request",
            {"email": "missing@example.com"},
            503,
        ),
        (
            "POST",
            "/password-recovery/reset",
            {
                "email": "missing@example.com",
                "code": "123456",
                "password": "New2@password",
                "confirm_password": "New2@password",
            },
            503,
        ),
        ("GET", "/login", None, 405),
        ("GET", "/nonexistent", None, 404),
    ],
    ids=[
        "invalid-registration",
        "invalid-login",
        "invalid-refresh",
        "unknown-refresh-token",
        "unauthenticated-me",
        "unauthenticated-logout",
        "disabled-recovery-request",
        "disabled-recovery-reset",
        "method-not-allowed",
        "unknown-auth-route",
    ],
)
def test_auth_error_responses_are_not_cacheable(
    client: TestClient,
    method: str,
    path: str,
    payload: dict[str, str] | None,
    expected_status: int,
) -> None:
    result = client.request(
        method,
        f"{AUTH}{path}",
        json=payload,
    )

    assert result.status_code == expected_status
    assert result.headers.get("cache-control") == "no-store"


def test_duplicate_registration_preserves_existing_contract(
    client: TestClient,
    account_email: str,
) -> None:
    first = client.post(
        f"{AUTH}/register",
        json=_registration_payload(account_email),
    )

    assert first.status_code == 201

    duplicate = client.post(
        f"{AUTH}/register",
        json=_registration_payload(account_email.upper()),
    )

    assert duplicate.status_code == 409
    assert duplicate.json() == {
        "error": {
            "code": "account_already_exists",
            "message": "Unable to create account.",
        }
    }
    assert duplicate.headers.get("cache-control") == "no-store"


@pytest.mark.parametrize("action", ["request", "confirm"])
def test_disabled_email_verification_is_not_cacheable(
    client: TestClient,
    account_email: str,
    action: str,
) -> None:
    registered = client.post(
        f"{AUTH}/register",
        json=_registration_payload(account_email),
    )

    assert registered.status_code == 201

    tokens = cast(dict[str, str], registered.json()["tokens"])

    result = client.post(
        f"{AUTH}/email-verification/{action}",
        headers={
            "Authorization": f"Bearer {tokens['access_token']}",
        },
        json={"code": "123456"} if action == "confirm" else None,
    )

    assert result.status_code == 503
    assert result.headers.get("cache-control") == "no-store"


def test_login_rate_limit_retains_no_store_and_retry_after(
    client: TestClient,
) -> None:
    email = f"rate-limit-{uuid4()}@example.com"

    for _ in range(5):
        result = client.post(
            f"{AUTH}/login",
            json={"email": email, "password": PASSWORD},
        )
        assert result.status_code == 401

    denied = client.post(
        f"{AUTH}/login",
        json={"email": email, "password": PASSWORD},
    )

    assert denied.status_code == 429
    assert denied.headers.get("cache-control") == "no-store"
    assert int(denied.headers["retry-after"]) > 0


def test_unavailable_rate_limiter_retains_no_store(
    test_settings: Settings,
) -> None:
    settings = test_settings.model_copy(update={"auth_rate_limit_secret": None})

    with TestClient(
        create_app(settings),
        client=("198.51.100.52", 50000),
    ) as api_client:
        result = api_client.post(
            f"{AUTH}/login",
            json={
                "email": f"missing-{uuid4()}@example.com",
                "password": PASSWORD,
            },
        )

    assert result.status_code == 503
    assert result.headers.get("cache-control") == "no-store"


@pytest.mark.parametrize(
    ("path", "expected_status"),
    [
        ("/health", 200),
        ("/api/v1/authentication", 404),
    ],
)
def test_auth_cache_policy_does_not_change_unrelated_routes(
    client: TestClient,
    path: str,
    expected_status: int,
) -> None:
    result = client.get(path)

    assert result.status_code == expected_status
    assert result.headers.get("cache-control") != "no-store"


def test_auth_cache_policy_respects_configured_api_prefix(
    test_settings: Settings,
) -> None:
    settings = test_settings.model_copy(update={"api_v1_prefix": "/custom/v1"})

    with TestClient(create_app(settings)) as api_client:
        result = api_client.post("/custom/v1/auth/login", json={})

    assert result.status_code == 422
    assert result.headers.get("cache-control") == "no-store"
