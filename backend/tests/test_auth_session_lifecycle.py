from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from psycopg import Error as PsycopgError
from sqlalchemy import Connection, Engine, delete, event, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import AuthRefreshToken, AuthSession, User
from fitmap.identity.security import create_access_token, decode_access_token
from fitmap.identity.sessions import (
    IssuedSessionTokens,
    RefreshRotationStatus,
    issue_session,
    revoke_session,
    revoke_session_by_refresh_token,
    rotate_refresh_token,
)

REFRESH_LOGOUT_PATH = "/api/v1/auth/logout/refresh"


@pytest.fixture
def issued_sessions(
    database_engine: Engine,
    test_settings: Settings,
) -> Iterator[tuple[IssuedSessionTokens, IssuedSessionTokens]]:
    user_id = uuid4()

    try:
        with Session(database_engine) as session:
            session.add(
                User(
                    id=user_id,
                    name="Session Lifecycle Test",
                    email=f"session-{user_id}@example.com",
                    password_hash="not-used-by-session-tests",
                    is_active=True,
                )
            )
            session.flush()

            first = issue_session(
                db_session=session,
                user_id=user_id,
                settings=test_settings,
            )
            second = issue_session(
                db_session=session,
                user_id=user_id,
                settings=test_settings,
            )
            session.commit()

        yield first, second
    finally:
        with database_engine.begin() as connection:
            connection.execute(delete(User).where(User.id == user_id))


def assert_session_revoked(
    database_engine: Engine,
    tokens: IssuedSessionTokens,
) -> None:
    with Session(database_engine) as session:
        auth_session = session.get(AuthSession, tokens.session_id)

        refresh_tokens = session.scalars(
            select(AuthRefreshToken).where(
                AuthRefreshToken.session_id == tokens.session_id,
            )
        ).all()

        assert auth_session is not None
        assert auth_session.revoked_at is not None
        assert refresh_tokens
        assert all(token.revoked_at is not None for token in refresh_tokens)


def assert_session_active(
    database_engine: Engine,
    tokens: IssuedSessionTokens,
) -> None:
    with Session(database_engine) as session:
        auth_session = session.get(AuthSession, tokens.session_id)

        assert auth_session is not None
        assert auth_session.revoked_at is None


def test_refresh_logout_revokes_session_with_expired_access_token(
    client: TestClient,
    database_engine: Engine,
    test_settings: Settings,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
) -> None:
    first, second = issued_sessions

    claims = decode_access_token(
        first.access_token,
        test_settings,
    )

    expired_token, _ = create_access_token(
        user_id=claims.user_id,
        session_id=claims.session_id,
        settings=test_settings,
        issued_at=datetime.now(UTC)
        - timedelta(
            minutes=test_settings.auth_access_token_minutes + 1,
        ),
    )

    original_logout = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert original_logout.status_code == 401

    # A rejected access token does not revoke the underlying session.
    assert_session_active(database_engine, first)

    response = client.post(
        REFRESH_LOGOUT_PATH,
        json={"refresh_token": first.refresh_token},
    )

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers.get("cache-control") == "no-store"

    assert_session_revoked(database_engine, first)
    assert_session_active(database_engine, second)

    rejected_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first.refresh_token},
    )

    assert rejected_refresh.status_code == 401


def test_refresh_logout_revokes_rotated_token_family(
    client: TestClient,
    database_engine: Engine,
    test_settings: Settings,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
) -> None:
    first, second = issued_sessions

    with Session(database_engine) as session:
        rotation = rotate_refresh_token(
            db_session=session,
            refresh_token=first.refresh_token,
            settings=test_settings,
        )

        assert rotation.status is RefreshRotationStatus.ROTATED
        assert rotation.tokens is not None

        replacement = rotation.tokens
        session.commit()

    # The client may still possess the consumed token when logout starts.
    response = client.post(
        REFRESH_LOGOUT_PATH,
        json={"refresh_token": first.refresh_token},
    )

    assert response.status_code == 204

    # Verify persistence before any subsequent refresh attempt.
    assert_session_revoked(database_engine, first)
    assert_session_active(database_engine, second)

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {replacement.access_token}"},
    )

    assert me.status_code == 401

    refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": replacement.refresh_token},
    )

    assert refresh.status_code == 401

    repeated_logout = client.post(
        REFRESH_LOGOUT_PATH,
        json={"refresh_token": first.refresh_token},
    )

    assert repeated_logout.status_code == 204
    assert repeated_logout.content == b""

    other_session = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {second.access_token}"},
    )

    assert other_session.status_code == 200


def test_refresh_logout_with_unknown_token_is_idempotent(
    client: TestClient,
    database_engine: Engine,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
) -> None:
    unknown = str(uuid4())

    response = client.post(
        REFRESH_LOGOUT_PATH,
        json={"refresh_token": unknown},
    )

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers.get("cache-control") == "no-store"

    for tokens in issued_sessions:
        assert_session_active(database_engine, tokens)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"refresh_token": ""},
        {"refresh_token": "x" * 513},
    ],
)
def test_refresh_logout_validates_payload(
    client: TestClient,
    payload: dict[str, str],
) -> None:
    response = client.post(
        REFRESH_LOGOUT_PATH,
        json=payload,
    )

    assert response.status_code == 422
    assert response.headers.get("cache-control") == "no-store"


def test_concurrent_logout_and_rotation_do_not_deadlock(
    database_engine: Engine,
    test_settings: Settings,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
) -> None:
    first, second = issued_sessions

    session_lock_requested = Event()

    def observe_session_lock(
        _connection: Connection,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        normalized = " ".join(statement.lower().split())

        if "auth_sessions" in normalized and "for update" in normalized:
            session_lock_requested.set()

    def rotate_in_parallel() -> RefreshRotationStatus:
        with Session(database_engine) as session:
            session.execute(text("SET LOCAL lock_timeout = '8s'"))
            session.execute(text("SET LOCAL statement_timeout = '12s'"))

            connection = session.connection()

            event.listen(
                connection,
                "before_cursor_execute",
                observe_session_lock,
            )

            try:
                rotation = rotate_refresh_token(
                    db_session=session,
                    refresh_token=first.refresh_token,
                    settings=test_settings,
                )
            finally:
                event.remove(
                    connection,
                    "before_cursor_execute",
                    observe_session_lock,
                )

            session.commit()

            return rotation.status

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            with Session(database_engine) as logout_session:
                logout_session.execute(text("SET LOCAL lock_timeout = '8s'"))
                logout_session.execute(text("SET LOCAL statement_timeout = '12s'"))

                locked_session_id = logout_session.scalar(
                    select(AuthSession.id)
                    .where(AuthSession.id == first.session_id)
                    .with_for_update()
                )

                assert locked_session_id == first.session_id

                # Logout owns the session row lock before refresh starts.
                future = executor.submit(rotate_in_parallel)

                assert session_lock_requested.wait(timeout=10), (
                    "Rotation did not reach its session lock."
                )

                # On the original implementation, refresh already holds
                # the token lock at this point. Revocation needs that lock.
                assert revoke_session(
                    db_session=logout_session,
                    session_id=first.session_id,
                )

                logout_session.commit()

            result = future.result(timeout=15)

    except DBAPIError as exc:
        original = exc.orig

        sqlstate = original.sqlstate if isinstance(original, PsycopgError) else "unknown"

        pytest.fail(
            f"Concurrent session operations failed: SQLSTATE {sqlstate}",
            pytrace=False,
        )

    assert result is RefreshRotationStatus.SESSION_REVOKED

    assert_session_revoked(database_engine, first)
    assert_session_active(database_engine, second)

    with Session(database_engine) as session:
        tokens = session.scalars(
            select(AuthRefreshToken).where(
                AuthRefreshToken.session_id == first.session_id,
            )
        ).all()

        # No replacement may be issued after logout owns the session lock.
        assert len(tokens) == 1


@pytest.mark.parametrize("operation", ["revoke", "replay"])
def test_concurrent_operation_after_rotation_owns_session_lock(
    database_engine: Engine,
    test_settings: Settings,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
    operation: str,
) -> None:
    first, second = issued_sessions

    session_lock_requested = Event()

    def observe_session_lock(
        _connection: Connection,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        normalized = " ".join(statement.lower().split())

        if "auth_sessions" in normalized and "for update" in normalized:
            session_lock_requested.set()

    def execute_in_parallel() -> bool | RefreshRotationStatus:
        with Session(database_engine) as session:
            session.execute(text("SET LOCAL lock_timeout = '8s'"))
            session.execute(text("SET LOCAL statement_timeout = '12s'"))

            connection = session.connection()

            event.listen(
                connection,
                "before_cursor_execute",
                observe_session_lock,
            )

            try:
                if operation == "revoke":
                    result = revoke_session_by_refresh_token(
                        db_session=session,
                        refresh_token=first.refresh_token,
                    )
                else:
                    rotation = rotate_refresh_token(
                        db_session=session,
                        refresh_token=first.refresh_token,
                        settings=test_settings,
                    )

                    assert rotation.tokens is None

                    result = rotation.status
            finally:
                event.remove(
                    connection,
                    "before_cursor_execute",
                    observe_session_lock,
                )

            session.commit()

            return result

    with ThreadPoolExecutor(max_workers=1) as executor:
        with Session(database_engine) as rotation_session:
            rotation_session.execute(text("SET LOCAL lock_timeout = '8s'"))
            rotation_session.execute(text("SET LOCAL statement_timeout = '12s'"))

            rotation = rotate_refresh_token(
                db_session=rotation_session,
                refresh_token=first.refresh_token,
                settings=test_settings,
            )

            assert rotation.status is RefreshRotationStatus.ROTATED
            assert rotation.tokens is not None

            # Rotation owns the session lock and has not committed.
            future = executor.submit(execute_in_parallel)

            assert session_lock_requested.wait(timeout=10), (
                "Concurrent operation did not reach the session lock."
            )

            rotation_session.commit()

        result = future.result(timeout=15)

    if operation == "revoke":
        assert result is True
    else:
        assert result is RefreshRotationStatus.SESSION_REVOKED

    # Neither revocation nor replay may leave the replacement active.
    assert_session_revoked(database_engine, first)
    assert_session_active(database_engine, second)

    with Session(database_engine) as session:
        tokens = session.scalars(
            select(AuthRefreshToken).where(
                AuthRefreshToken.session_id == first.session_id,
            )
        ).all()

        assert len(tokens) == 2
        assert all(token.revoked_at is not None for token in tokens)


@pytest.mark.parametrize("operation", ["rotate", "revoke"])
def test_rotation_reloads_stale_orm_state(
    database_engine: Engine,
    test_settings: Settings,
    issued_sessions: tuple[IssuedSessionTokens, IssuedSessionTokens],
    operation: str,
) -> None:
    first, second = issued_sessions

    with Session(
        database_engine,
        expire_on_commit=False,
    ) as stale_session:
        cached_session = stale_session.get(
            AuthSession,
            first.session_id,
        )

        cached_token = stale_session.scalar(
            select(AuthRefreshToken).where(
                AuthRefreshToken.session_id == first.session_id,
            )
        )

        assert cached_session is not None
        assert cached_token is not None

        assert cached_session.revoked_at is None
        assert cached_token.consumed_at is None
        assert cached_token.revoked_at is None

        # Keep the original ORM instances alive while another
        # transaction changes the persisted authentication state.
        with Session(database_engine) as changing_session:
            if operation == "rotate":
                rotation = rotate_refresh_token(
                    db_session=changing_session,
                    refresh_token=first.refresh_token,
                    settings=test_settings,
                )

                assert rotation.status is RefreshRotationStatus.ROTATED
                assert rotation.tokens is not None
            else:
                assert revoke_session_by_refresh_token(
                    db_session=changing_session,
                    refresh_token=first.refresh_token,
                )

            changing_session.commit()

        # The original ORM instances still contain stale values.
        assert cached_session.revoked_at is None
        assert cached_token.consumed_at is None
        assert cached_token.revoked_at is None

        rejected = rotate_refresh_token(
            db_session=stale_session,
            refresh_token=first.refresh_token,
            settings=test_settings,
        )

        assert rejected.status is RefreshRotationStatus.SESSION_REVOKED
        assert rejected.tokens is None
        assert cached_session.revoked_at is not None

        stale_session.commit()

    assert_session_revoked(database_engine, first)
    assert_session_active(database_engine, second)

    with Session(database_engine) as session:
        tokens = session.scalars(
            select(AuthRefreshToken).where(
                AuthRefreshToken.session_id == first.session_id,
            )
        ).all()

        expected_count = 2 if operation == "rotate" else 1

        assert len(tokens) == expected_count
        assert all(token.revoked_at is not None for token in tokens)
