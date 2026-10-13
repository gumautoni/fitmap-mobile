from typing import TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.identity.models import User, UserProfile


class ProfileUpdateValues(TypedDict, total=False):
    name: str
    fitness_goal: str | None
    experience_level: str | None
    weekly_workout_goal: int | None
    preferred_workout_duration_minutes: int | None
    measurement_system: str | None


_PROFILE_FIELDS = (
    "fitness_goal",
    "experience_level",
    "weekly_workout_goal",
    "preferred_workout_duration_minutes",
    "measurement_system",
)


def get_user_profile(
    *,
    db_session: Session,
    user_id: UUID,
) -> UserProfile | None:
    return db_session.scalar(
        select(UserProfile).where(
            UserProfile.user_id == user_id,
        )
    )


def update_user_profile(
    *,
    db_session: Session,
    user: User,
    updates: ProfileUpdateValues,
) -> UserProfile | None:
    if "name" in updates:
        user.name = updates["name"]
        db_session.add(user)

    profile_fields_requested = any(field in updates for field in _PROFILE_FIELDS)

    if not profile_fields_requested:
        db_session.flush()

        return get_user_profile(
            db_session=db_session,
            user_id=user.id,
        )

    profile = get_user_profile(
        db_session=db_session,
        user_id=user.id,
    )

    if profile is None:
        has_profile_value = any(
            updates.get(field) is not None for field in _PROFILE_FIELDS if field in updates
        )

        if not has_profile_value:
            db_session.flush()
            return None

        profile = UserProfile(
            user_id=user.id,
        )

    if "fitness_goal" in updates:
        profile.fitness_goal = updates["fitness_goal"]

    if "experience_level" in updates:
        profile.experience_level = updates["experience_level"]

    if "weekly_workout_goal" in updates:
        profile.weekly_workout_goal = updates["weekly_workout_goal"]

    if "preferred_workout_duration_minutes" in updates:
        profile.preferred_workout_duration_minutes = updates["preferred_workout_duration_minutes"]

    if "measurement_system" in updates:
        profile.measurement_system = updates["measurement_system"]

    db_session.add(profile)
    db_session.flush()

    return profile
