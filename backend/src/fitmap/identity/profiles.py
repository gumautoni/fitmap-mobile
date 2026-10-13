from sqlalchemy.orm import Session

from fitmap.identity.models import User


def update_user_profile(
    *,
    db_session: Session,
    user: User,
    name: str,
) -> User:
    user.name = name

    db_session.add(user)
    db_session.flush()

    return user
