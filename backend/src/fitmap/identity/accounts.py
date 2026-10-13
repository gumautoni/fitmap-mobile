from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.identity.security import hash_password, verify_password


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def create_user(
    *,
    db_session: Session,
    name: str,
    email: str,
    password: str,
) -> User:
    user = User(
        name=name,
        email=normalize_email(email),
        password_hash=hash_password(password),
        is_active=True,
    )

    db_session.add(user)
    db_session.flush()

    return user


def find_user_by_email(
    *,
    db_session: Session,
    email: str,
) -> User | None:
    return db_session.scalar(
        select(User).where(
            User.email == normalize_email(email),
        )
    )


def authenticate_user(
    *,
    db_session: Session,
    email: str,
    password: str,
) -> User | None:
    user = find_user_by_email(
        db_session=db_session,
        email=email,
    )

    password_hash = user.password_hash if user is not None else _get_dummy_password_hash()

    password_matches = verify_password(
        password,
        password_hash,
    )

    if user is None or not user.is_active or not password_matches:
        return None

    return user


@lru_cache
def _get_dummy_password_hash() -> str:
    return hash_password("FitMap-dummy-authentication-password")
