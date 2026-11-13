"""Atomic PostgreSQL rate-limit tests; no public security endpoints are enabled."""

from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.security.rate_limit_models import AuthRateLimitBucket
from fitmap.security.rate_limits import (
    RateLimitAction,
    RateLimitConfigurationError,
    consume_auth_rate_limit,
    prune_old_rate_limit_buckets,
)

NOW = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)


@pytest.fixture
def db_session(database_engine: Engine) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def new_buckets(db_session: Session) -> Callable[[], list[AuthRateLimitBucket]]:
    """Return only rows inserted by this test, ignoring earlier committed test runs."""
    existing = set(db_session.scalars(select(AuthRateLimitBucket.key_hash)).all())

    def rows_created_in_this_test() -> list[AuthRateLimitBucket]:
        return [
            row
            for row in db_session.scalars(select(AuthRateLimitBucket)).all()
            if row.key_hash not in existing
        ]

    return rows_created_in_this_test


@pytest.fixture
def limiter_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={"auth_rate_limit_secret": SecretStr(f"test-only-rate-limit-key-{uuid4()}-private")}
    )


def charge(
    db_session: Session,
    settings: Settings,
    *,
    action: RateLimitAction = "password_recovery_request",
    ip: str = "198.51.100.10",
    identifier: str = "person@example.com",
    now: datetime = NOW,
) -> bool:
    result = consume_auth_rate_limit(
        db_session=db_session,
        settings=settings,
        action=action,
        client_ip=ip,
        identifier=identifier,
        now=now,
    )
    assert (result.retry_after_seconds == 0) == result.allowed
    return result.allowed


def test_first_request_creates_two_opaque_buckets(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    assert charge(db_session, limiter_settings)
    rows = new_buckets()
    assert len(rows) == 2
    assert all(row.request_count == 1 for row in rows)
    assert all(len(row.key_hash) == 64 for row in rows)
    assert all("person" not in row.key_hash and "198.51" not in row.key_hash for row in rows)


def test_ipv4_mapped_ipv6_uses_same_network_bucket(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    assert charge(db_session, limiter_settings, ip="198.51.100.10")
    assert charge(db_session, limiter_settings, ip="::ffff:198.51.100.10")
    rows = new_buckets()
    assert len(rows) == 2
    assert all(row.request_count == 2 for row in rows)


def test_recovery_request_identifier_limit_with_many_ips(
    db_session: Session, limiter_settings: Settings
) -> None:
    for index in range(3):
        assert charge(db_session, limiter_settings, ip=f"198.51.100.{index + 1}")
    decision = consume_auth_rate_limit(
        db_session=db_session,
        settings=limiter_settings,
        action="password_recovery_request",
        client_ip="198.51.100.9",
        identifier="PERSON@EXAMPLE.COM",
        now=NOW,
    )
    assert not decision.allowed
    assert decision.retry_after_seconds == 3600


def test_network_limit_even_with_unique_identifiers(
    db_session: Session, limiter_settings: Settings
) -> None:
    for index in range(8):
        assert charge(db_session, limiter_settings, identifier=f"person{index}@example.com")
    assert not charge(db_session, limiter_settings, identifier="person8@example.com")


def test_expired_window_resets_counter_and_preserves_other_window(
    db_session: Session, limiter_settings: Settings
) -> None:
    for index in range(3):
        assert charge(db_session, limiter_settings, ip=f"203.0.113.{index + 1}")
    assert not charge(
        db_session, limiter_settings, ip="203.0.113.4", now=NOW + timedelta(minutes=15)
    )
    assert charge(db_session, limiter_settings, ip="203.0.113.5", now=NOW + timedelta(hours=1))


def test_recovery_reset_uses_separate_short_window(
    db_session: Session, limiter_settings: Settings
) -> None:
    for index in range(5):
        assert charge(
            db_session,
            limiter_settings,
            action="password_recovery_reset",
            ip=f"198.51.100.{index + 1}",
        )
    assert not charge(
        db_session, limiter_settings, action="password_recovery_reset", ip="198.51.100.99"
    )
    assert charge(
        db_session,
        limiter_settings,
        action="password_recovery_reset",
        ip="198.51.100.99",
        now=NOW + timedelta(minutes=15),
    )


def test_verification_uses_authenticated_uuid_and_distinct_action_keys(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    identity = str(uuid4())
    assert charge(
        db_session,
        limiter_settings,
        action="email_verification_issue",
        identifier=identity,
    )
    assert charge(
        db_session,
        limiter_settings,
        action="email_verification_confirm",
        identifier=identity,
    )
    assert len(new_buckets()) == 4


def test_invalid_input_is_rejected_without_database_writes(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    cases: list[tuple[RateLimitAction, str, str, datetime]] = [
        ("password_recovery_request", "spoofed-client", "p@example.com", NOW),
        ("password_recovery_request", "198.51.100.1", "not-an-email", NOW),
        ("email_verification_confirm", "198.51.100.1", "not-a-uuid", NOW),
        ("email_verification_issue", "198.51.100.1", str(uuid4()), datetime(2026, 10, 30)),
    ]
    for action, ip, identifier, now in cases:
        with pytest.raises(ValueError):
            consume_auth_rate_limit(
                db_session=db_session,
                settings=limiter_settings,
                action=action,
                client_ip=ip,
                identifier=identifier,
                now=now,
            )
    assert new_buckets() == []


def test_separate_secret_is_required_and_must_not_equal_jwt(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    test_settings: Settings,
) -> None:
    missing = test_settings.model_copy(update={"auth_rate_limit_secret": None})
    with pytest.raises(RateLimitConfigurationError, match="dedicated"):
        charge(db_session, missing)
    bad = test_settings.model_copy(update={"auth_rate_limit_secret": test_settings.auth_jwt_secret})
    with pytest.raises(RateLimitConfigurationError, match="independent"):
        charge(db_session, bad)
    assert new_buckets() == []


def test_counters_saturate_and_reuse_same_opaque_bucket(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    for _ in range(25):
        consume_auth_rate_limit(
            db_session=db_session,
            settings=limiter_settings,
            action="password_recovery_request",
            client_ip="203.0.113.77",
            identifier="target@example.com",
            now=NOW,
        )
    rows = new_buckets()
    assert len(rows) == 2
    assert {row.request_count for row in rows} == {4, 9}


def test_prune_retains_active_windows_and_deletes_old_rows(
    db_session: Session,
    new_buckets: Callable[[], list[AuthRateLimitBucket]],
    limiter_settings: Settings,
) -> None:
    assert charge(db_session, limiter_settings)
    prune_old_rate_limit_buckets(db_session=db_session, now=NOW + timedelta(hours=3))
    assert len(new_buckets()) == 2
    prune_old_rate_limit_buckets(db_session=db_session, now=NOW + timedelta(hours=25))
    assert new_buckets() == []


def test_atomic_postgresql_upsert_under_parallel_transactions(
    database_engine: Engine, limiter_settings: Settings
) -> None:
    identifier_prefix = uuid4().hex
    address = "192.0.2.222"

    def attempt(index: int) -> bool:
        with Session(database_engine) as session:
            allowed = charge(
                session,
                limiter_settings,
                ip=address,
                identifier=f"{identifier_prefix}-{index}@example.com",
            )
            session.commit()
            return allowed

    # All workers hit the same IP bucket; atomic UPSERT prevents the first-row race.
    # These workers commit independently and bypass the rollback-only db_session fixture.
    # Remove only the keys inserted by this test, even if an assertion fails.
    with database_engine.connect() as connection:
        existing_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())

    try:
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(attempt, range(12)))
        assert sum(results) == 8
    finally:
        with database_engine.begin() as connection:
            all_keys = set(connection.scalars(select(AuthRateLimitBucket.key_hash)).all())
            new_keys = all_keys - existing_keys
            if new_keys:
                connection.execute(
                    delete(AuthRateLimitBucket).where(AuthRateLimitBucket.key_hash.in_(new_keys))
                )


@pytest.mark.parametrize(
    ("action", "maximum", "window"),
    [
        ("login", 5, timedelta(minutes=15)),
        ("register", 3, timedelta(hours=1)),
    ],
)
def test_login_and_register_identity_limits(
    db_session: Session,
    limiter_settings: Settings,
    action: RateLimitAction,
    maximum: int,
    window: timedelta,
) -> None:
    for index in range(maximum):
        assert charge(
            db_session,
            limiter_settings,
            action=action,
            ip=f"198.51.100.{index + 1}",
            identifier="person@example.com",
        )

    decision = consume_auth_rate_limit(
        db_session=db_session,
        settings=limiter_settings,
        action=action,
        client_ip="198.51.100.99",
        identifier="PERSON@EXAMPLE.COM",
        now=NOW,
    )

    assert not decision.allowed
    assert decision.retry_after_seconds == int(window.total_seconds())

    assert charge(
        db_session,
        limiter_settings,
        action=action,
        ip="198.51.100.100",
        identifier="person@example.com",
        now=NOW + window,
    )


@pytest.mark.parametrize(
    ("action", "maximum", "window"),
    [
        ("login", 30, timedelta(minutes=15)),
        ("register", 10, timedelta(hours=1)),
    ],
)
def test_login_and_register_network_limits(
    db_session: Session,
    limiter_settings: Settings,
    action: RateLimitAction,
    maximum: int,
    window: timedelta,
) -> None:
    for index in range(maximum):
        assert charge(
            db_session,
            limiter_settings,
            action=action,
            ip="203.0.113.10",
            identifier=f"person-{index}@example.com",
        )

    decision = consume_auth_rate_limit(
        db_session=db_session,
        settings=limiter_settings,
        action=action,
        client_ip="203.0.113.10",
        identifier="another-person@example.com",
        now=NOW,
    )

    assert not decision.allowed
    assert decision.retry_after_seconds == int(window.total_seconds())

    assert charge(
        db_session,
        limiter_settings,
        action=action,
        ip="203.0.113.10",
        identifier="new-person@example.com",
        now=NOW + window,
    )


def test_login_and_register_use_independent_buckets(
    db_session: Session,
    limiter_settings: Settings,
) -> None:
    for _ in range(5):
        assert charge(
            db_session,
            limiter_settings,
            action="login",
        )

    assert not charge(
        db_session,
        limiter_settings,
        action="login",
    )

    assert charge(
        db_session,
        limiter_settings,
        action="register",
    )

    assert not charge(
        db_session,
        limiter_settings,
        action="login",
    )
