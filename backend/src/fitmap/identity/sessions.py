from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.models import AuthRefreshToken, AuthSession
from fitmap.identity.security import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
)


@dataclass(frozen=True, slots=True, repr=False)
class IssuedSessionTokens:
    session_id: UUID
    access_token: str
    access_token_expires_at: datetime
    refresh_token: str
    refresh_token_expires_at: datetime
    session_expires_at: datetime


def issue_session(
    *,
    db_session: Session,
    user_id: UUID,
    settings: Settings,
    issued_at: datetime | None = None,
) -> IssuedSessionTokens:
    now = issued_at or datetime.now(UTC)
    session_id = uuid4()
    session_expires_at = now + timedelta(
        days=settings.auth_refresh_token_days,
    )

    auth_session = AuthSession(
        id=session_id,
        user_id=user_id,
        expires_at=session_expires_at,
    )
    db_session.add(auth_session)
    db_session.flush()

    refresh_material = create_refresh_token(
        settings=settings,
        issued_at=now,
    )
    refresh_expires_at = min(
        refresh_material.expires_at,
        session_expires_at,
    )

    refresh_token = AuthRefreshToken(
        id=uuid4(),
        session_id=session_id,
        token_hash=refresh_material.token_hash,
        expires_at=refresh_expires_at,
    )
    db_session.add(refresh_token)
    db_session.flush()

    access_token, access_token_expires_at = create_access_token(
        user_id=user_id,
        session_id=session_id,
        settings=settings,
        issued_at=now,
    )

    return IssuedSessionTokens(
        session_id=session_id,
        access_token=access_token,
        access_token_expires_at=access_token_expires_at,
        refresh_token=refresh_material.token,
        refresh_token_expires_at=refresh_expires_at,
        session_expires_at=session_expires_at,
    )


def rotate_refresh_token(
    *,
    db_session: Session,
    refresh_token: str,
    settings: Settings,
    rotated_at: datetime | None = None,
) -> IssuedSessionTokens | None:
    now = rotated_at or datetime.now(UTC)
    token_hash = hash_refresh_token(refresh_token)

    current_token = db_session.scalar(
        select(AuthRefreshToken).where(AuthRefreshToken.token_hash == token_hash).with_for_update()
    )

    if current_token is None:
        return None

    auth_session = db_session.scalar(
        select(AuthSession).where(AuthSession.id == current_token.session_id).with_for_update()
    )

    if auth_session is None:
        return None

    if current_token.consumed_at is not None or current_token.revoked_at is not None:
        _revoke_session(
            db_session=db_session,
            auth_session=auth_session,
            revoked_at=now,
        )
        return None

    if (
        auth_session.revoked_at is not None
        or auth_session.expires_at <= now
        or current_token.expires_at <= now
    ):
        _revoke_session(
            db_session=db_session,
            auth_session=auth_session,
            revoked_at=now,
        )
        return None

    current_token.consumed_at = now
    auth_session.last_used_at = now

    replacement_material = create_refresh_token(
        settings=settings,
        issued_at=now,
    )
    replacement_expires_at = min(
        replacement_material.expires_at,
        auth_session.expires_at,
    )

    replacement_token = AuthRefreshToken(
        id=uuid4(),
        session_id=auth_session.id,
        token_hash=replacement_material.token_hash,
        expires_at=replacement_expires_at,
    )
    db_session.add(replacement_token)
    db_session.flush()

    current_token.replaced_by_token_id = replacement_token.id

    access_token, access_token_expires_at = create_access_token(
        user_id=auth_session.user_id,
        session_id=auth_session.id,
        settings=settings,
        issued_at=now,
    )

    return IssuedSessionTokens(
        session_id=auth_session.id,
        access_token=access_token,
        access_token_expires_at=access_token_expires_at,
        refresh_token=replacement_material.token,
        refresh_token_expires_at=replacement_expires_at,
        session_expires_at=auth_session.expires_at,
    )


def revoke_session(
    *,
    db_session: Session,
    session_id: UUID,
    revoked_at: datetime | None = None,
) -> bool:
    now = revoked_at or datetime.now(UTC)

    auth_session = db_session.scalar(
        select(AuthSession).where(AuthSession.id == session_id).with_for_update()
    )

    if auth_session is None:
        return False

    _revoke_session(
        db_session=db_session,
        auth_session=auth_session,
        revoked_at=now,
    )
    return True


def is_session_active(
    *,
    db_session: Session,
    session_id: UUID,
    user_id: UUID,
    checked_at: datetime | None = None,
) -> bool:
    now = checked_at or datetime.now(UTC)

    auth_session = db_session.scalar(
        select(AuthSession).where(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
        )
    )

    if auth_session is None:
        return False

    return auth_session.revoked_at is None and auth_session.expires_at > now


def _revoke_session(
    *,
    db_session: Session,
    auth_session: AuthSession,
    revoked_at: datetime,
) -> None:
    if auth_session.revoked_at is None:
        auth_session.revoked_at = revoked_at

    db_session.execute(
        update(AuthRefreshToken)
        .where(
            AuthRefreshToken.session_id == auth_session.id,
            AuthRefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=revoked_at)
    )
