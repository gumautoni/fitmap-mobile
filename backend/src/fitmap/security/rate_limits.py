"""PostgreSQL-backed, atomic rate limits for authentication endpoints.

The caller must commit EVEN ON DENIAL: a rollback erases the throttling event.
Never use untrusted X-Forwarded-For.
"""

import hmac
import ipaddress
import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Literal
from uuid import UUID

from sqlalchemy import case, delete, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import normalize_email
from fitmap.security.rate_limit_models import AuthRateLimitBucket

RateLimitAction = Literal[
    "login",
    "register",
    "password_recovery_request",
    "password_recovery_reset",
    "email_verification_issue",
    "email_verification_confirm",
]


@dataclass(frozen=True, slots=True)
class _Rule:
    maximum: int
    window: timedelta


# Independent guards: network floods and distributed attacks against an identity.
_RULES: dict[RateLimitAction, tuple[_Rule, _Rule]] = {
    "login": (_Rule(30, timedelta(minutes=15)), _Rule(5, timedelta(minutes=15))),
    "register": (_Rule(10, timedelta(hours=1)), _Rule(3, timedelta(hours=1))),
    "password_recovery_request": (_Rule(8, timedelta(minutes=15)), _Rule(3, timedelta(hours=1))),
    "password_recovery_reset": (_Rule(20, timedelta(minutes=15)), _Rule(5, timedelta(minutes=15))),
    "email_verification_issue": (_Rule(8, timedelta(minutes=15)), _Rule(3, timedelta(hours=1))),
    "email_verification_confirm": (
        _Rule(20, timedelta(minutes=15)),
        _Rule(5, timedelta(minutes=15)),
    ),
}


class RateLimitConfigurationError(RuntimeError):
    """Raised when the dedicated HMAC secret is unavailable or unsafe."""


@dataclass(frozen=True, slots=True, repr=False)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int


def _rate_key(settings: Settings) -> bytes:
    configured = settings.auth_rate_limit_secret
    if configured is None or len(configured.get_secret_value().encode()) < 32:
        raise RateLimitConfigurationError("A dedicated 32+ byte rate-limit secret is required.")
    value = configured.get_secret_value()

    if not value.strip() or value.strip().casefold().startswith("replace-with-"):
        raise RateLimitConfigurationError("A valid independent rate-limit secret is required.")

    other = [settings.auth_jwt_secret.get_secret_value()]
    for candidate in (
        settings.auth_recovery_code_secret,
        settings.auth_email_verification_secret,
        settings.email_outbox_encryption_key,
    ):
        if candidate is not None:
            other.append(candidate.get_secret_value())
    if value in other:
        raise RateLimitConfigurationError("The rate-limit secret must be independent.")
    return value.encode()


def _utc(value: datetime | None) -> datetime:
    current = datetime.now(UTC) if value is None else value
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("Rate-limit timestamps must be timezone-aware.")
    return current.astimezone(UTC)


def _identity(action: RateLimitAction, identifier: str) -> str:
    if action.startswith("email_verification_"):
        try:
            return str(UUID(identifier))
        except (ValueError, AttributeError):
            raise ValueError("Expected an authenticated user UUID.") from None
    email = normalize_email(identifier)
    if not email or len(email) > 320 or "@" not in email or any(char.isspace() for char in email):
        raise ValueError("Invalid email identifier.")
    return email


def _bucket_hash(key: bytes, action: RateLimitAction, kind: str, value: str) -> str:
    material = f"fitmap-auth-rate:v1:{action}:{kind}:{value}".encode()
    return hmac.new(key, material, sha256).hexdigest()


def _consume_bucket(
    *, db_session: Session, key_hash: str, rule: _Rule, current: datetime
) -> tuple[bool, int]:
    """Atomic UPSERT: no first-request race, even with parallel API workers."""
    bucket = AuthRateLimitBucket
    cutoff = current - rule.window
    expired = bucket.window_started_at <= cutoff
    statement = pg_insert(bucket).values(
        key_hash=key_hash,
        request_count=1,
        window_started_at=current,
        last_seen_at=current,
    )
    statement = statement.on_conflict_do_update(
        index_elements=[bucket.key_hash],
        set_={
            "request_count": case(
                (expired, 1),
                else_=func.least(bucket.request_count + 1, rule.maximum + 1),
            ),
            "window_started_at": case((expired, current), else_=bucket.window_started_at),
            "last_seen_at": current,
        },
    ).returning(bucket.request_count, bucket.window_started_at)
    count, started_at = db_session.execute(statement).one()
    if count <= rule.maximum:
        return True, 0
    remaining = (started_at + rule.window - current).total_seconds()
    return False, max(1, math.ceil(remaining))


def consume_auth_rate_limit(
    *,
    db_session: Session,
    settings: Settings,
    action: RateLimitAction,
    client_ip: str,
    identifier: str,
    now: datetime | None = None,
) -> RateLimitDecision:
    """Charge network and identity buckets in a SINGLE caller-managed transaction.

    For verification actions `identifier` is the server-authenticated user UUID.
    For login, registration and recovery it is an email, regardless of account existence.
    The HTTP boundary must derive the client IP from a trusted ASGI peer/proxy
    and commit the transaction also when allowed=False. Fail closed on DB errors.
    """
    current = _utc(now)
    key = _rate_key(settings)
    if action not in _RULES:
        raise ValueError("Unsupported authentication rate-limit action.")
    try:
        address = ipaddress.ip_address(client_ip)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
            canonical_ip = address.ipv4_mapped.compressed
        else:
            canonical_ip = address.compressed
    except ValueError:
        raise ValueError("A canonical client IP is required.") from None
    canonical_identity = _identity(action, identifier)
    ip_rule, identity_rule = _RULES[action]
    # Deliberate fixed order and no early return: both guards are charged,
    # regardless of account existence or whether the first guard denied.
    ip_allowed, ip_retry = _consume_bucket(
        db_session=db_session,
        key_hash=_bucket_hash(key, action, "ip", canonical_ip),
        rule=ip_rule,
        current=current,
    )
    identity_allowed, identity_retry = _consume_bucket(
        db_session=db_session,
        key_hash=_bucket_hash(key, action, "identity", canonical_identity),
        rule=identity_rule,
        current=current,
    )
    return RateLimitDecision(
        allowed=ip_allowed and identity_allowed,
        retry_after_seconds=max(ip_retry, identity_retry),
    )


def prune_old_rate_limit_buckets(*, db_session: Session, now: datetime | None = None) -> None:
    """Optional maintenance; prune only after all configured windows expire.

    Caller owns the transaction; schedule this separately from sensitive routes.
    """
    current = _utc(now)
    db_session.execute(
        delete(AuthRateLimitBucket).where(
            AuthRateLimitBucket.last_seen_at < current - timedelta(hours=24)
        )
    )
