from fastapi import APIRouter

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.identity.models import User, UserProfile
from fitmap.identity.profiles import (
    ProfileUpdateValues,
    get_user_profile,
    update_user_profile,
)
from fitmap.identity.schemas import (
    ExperienceLevel,
    FitnessGoal,
    MeasurementSystem,
    ProfileResponse,
    ProfileUpdateRequest,
)

router = APIRouter(
    prefix="/profile",
    tags=["profile"],
)


def build_profile_response(
    *,
    user: User,
    profile: UserProfile | None,
) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        fitness_goal=(
            FitnessGoal(profile.fitness_goal)
            if profile is not None and profile.fitness_goal is not None
            else None
        ),
        experience_level=(
            ExperienceLevel(profile.experience_level)
            if profile is not None and profile.experience_level is not None
            else None
        ),
        weekly_workout_goal=(profile.weekly_workout_goal if profile is not None else None),
        preferred_workout_duration_minutes=(
            profile.preferred_workout_duration_minutes if profile is not None else None
        ),
        measurement_system=(
            MeasurementSystem(profile.measurement_system)
            if profile is not None and profile.measurement_system is not None
            else None
        ),
    )


def build_profile_updates(
    payload: ProfileUpdateRequest,
) -> ProfileUpdateValues:
    updates: ProfileUpdateValues = {}
    fields_set = payload.model_fields_set

    if "name" in fields_set:
        if payload.name is None:
            raise ValueError("Validated profile name must not be null.")

        updates["name"] = payload.name

    if "fitness_goal" in fields_set:
        updates["fitness_goal"] = (
            payload.fitness_goal.value if payload.fitness_goal is not None else None
        )

    if "experience_level" in fields_set:
        updates["experience_level"] = (
            payload.experience_level.value if payload.experience_level is not None else None
        )

    if "weekly_workout_goal" in fields_set:
        updates["weekly_workout_goal"] = payload.weekly_workout_goal

    if "preferred_workout_duration_minutes" in fields_set:
        updates["preferred_workout_duration_minutes"] = payload.preferred_workout_duration_minutes

    if "measurement_system" in fields_set:
        updates["measurement_system"] = (
            payload.measurement_system.value if payload.measurement_system is not None else None
        )

    return updates


@router.get(
    "",
    response_model=ProfileResponse,
)
def get_profile(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> ProfileResponse:
    profile = get_user_profile(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return build_profile_response(
        user=identity.user,
        profile=profile,
    )


@router.patch(
    "",
    response_model=ProfileResponse,
)
def update_profile(
    payload: ProfileUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> ProfileResponse:
    profile = update_user_profile(
        db_session=db_session,
        user=identity.user,
        updates=build_profile_updates(payload),
    )

    db_session.commit()
    db_session.refresh(identity.user)

    if profile is not None:
        db_session.refresh(profile)

    return build_profile_response(
        user=identity.user,
        profile=profile,
    )
