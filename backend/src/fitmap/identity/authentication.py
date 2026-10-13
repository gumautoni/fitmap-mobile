from dataclasses import dataclass

from sqlalchemy.orm import Session

from fitmap.config import Settings
from fitmap.identity.accounts import (
    authenticate_user,
    create_user,
    find_user_by_email,
)
from fitmap.identity.models import User
from fitmap.identity.sessions import IssuedSessionTokens, issue_session


class AccountAlreadyExistsError(Exception):
    pass


@dataclass(frozen=True, slots=True, repr=False)
class AuthenticationResult:
    user: User
    tokens: IssuedSessionTokens


def register_user(
    *,
    db_session: Session,
    settings: Settings,
    name: str,
    email: str,
    password: str,
) -> AuthenticationResult:
    existing_user = find_user_by_email(
        db_session=db_session,
        email=email,
    )

    if existing_user is not None:
        raise AccountAlreadyExistsError

    user = create_user(
        db_session=db_session,
        name=name,
        email=email,
        password=password,
    )

    tokens = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=settings,
    )

    return AuthenticationResult(
        user=user,
        tokens=tokens,
    )


def login_user(
    *,
    db_session: Session,
    settings: Settings,
    email: str,
    password: str,
) -> AuthenticationResult | None:
    user = authenticate_user(
        db_session=db_session,
        email=email,
        password=password,
    )

    if user is None:
        return None

    tokens = issue_session(
        db_session=db_session,
        user_id=user.id,
        settings=settings,
    )

    return AuthenticationResult(
        user=user,
        tokens=tokens,
    )
