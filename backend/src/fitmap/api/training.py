from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Response, status
from sqlalchemy import select

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.training.models import Exercise, Workout, WorkoutExercise
from fitmap.training.planning import (
    ExerciseUnavailableError,
    InvalidWorkoutExerciseConfigurationError,
    InvalidWorkoutReorderError,
    TrainingError,
    WorkoutArchivedError,
    WorkoutExerciseNotFoundError,
    WorkoutExerciseUpdateValues,
    WorkoutNotFoundError,
    add_exercise_to_workout,
    archive_workout,
    create_custom_exercise,
    create_workout,
    get_owned_workout,
    list_available_exercises,
    list_workout_exercises,
    list_workouts,
    remove_workout_exercise,
    rename_workout,
    reorder_workout_exercises,
    restore_workout,
    update_workout_exercise,
)
from fitmap.training.schemas import (
    CustomExerciseCreateRequest,
    ExerciseOrigin,
    ExerciseResponse,
    LoadUnit,
    WorkoutCreateRequest,
    WorkoutExerciseCreateRequest,
    WorkoutExerciseResponse,
    WorkoutExerciseUpdateRequest,
    WorkoutReorderRequest,
    WorkoutResponse,
    WorkoutSummaryResponse,
    WorkoutUpdateRequest,
)

router = APIRouter(
    prefix="/training",
    tags=["training"],
)


@router.get(
    "/exercises",
    response_model=list[ExerciseResponse],
)
def get_exercises(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[ExerciseResponse]:
    exercises = list_available_exercises(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [_build_exercise_response(exercise) for exercise in exercises]


@router.post(
    "/exercises",
    response_model=ExerciseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_exercise(
    payload: CustomExerciseCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> ExerciseResponse:
    exercise = create_custom_exercise(
        db_session=db_session,
        user_id=identity.user.id,
        name=payload.name,
    )

    db_session.commit()
    db_session.refresh(exercise)

    return _build_exercise_response(exercise)


@router.get(
    "/workouts",
    response_model=list[WorkoutSummaryResponse],
)
def get_workouts(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    include_archived: bool = False,
) -> list[WorkoutSummaryResponse]:
    workouts = list_workouts(
        db_session=db_session,
        user_id=identity.user.id,
        include_archived=include_archived,
    )

    return [_build_workout_summary_response(workout) for workout in workouts]


@router.post(
    "/workouts",
    response_model=WorkoutResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_workout(
    payload: WorkoutCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    workout = create_workout(
        db_session=db_session,
        user_id=identity.user.id,
        name=payload.name,
    )

    db_session.commit()
    db_session.refresh(workout)

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.get(
    "/workouts/{workout_id}",
    response_model=WorkoutResponse,
)
def get_workout(
    workout_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    workout = get_owned_workout(
        db_session=db_session,
        user_id=identity.user.id,
        workout_id=workout_id,
    )

    if workout is None:
        raise _workout_not_found_error()

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.patch(
    "/workouts/{workout_id}",
    response_model=WorkoutResponse,
)
def update_workout(
    workout_id: UUID,
    payload: WorkoutUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    if "name" not in payload.model_fields_set or payload.name is None:
        raise _request_validation_error()

    try:
        workout = rename_workout(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
            name=payload.name,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()
    db_session.refresh(workout)

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.post(
    "/workouts/{workout_id}/archive",
    response_model=WorkoutResponse,
)
def archive_existing_workout(
    workout_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    try:
        workout = archive_workout(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()
    db_session.refresh(workout)

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.post(
    "/workouts/{workout_id}/restore",
    response_model=WorkoutResponse,
)
def restore_existing_workout(
    workout_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    try:
        workout = restore_workout(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()
    db_session.refresh(workout)

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.post(
    "/workouts/{workout_id}/exercises",
    response_model=WorkoutResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_workout_exercise(
    workout_id: UUID,
    payload: WorkoutExerciseCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    try:
        add_exercise_to_workout(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
            exercise_id=payload.exercise_id,
            target_sets=payload.target_sets,
            target_repetitions=payload.target_repetitions,
            target_load=payload.target_load,
            target_load_unit=(
                payload.target_load_unit.value if payload.target_load_unit is not None else None
            ),
            notes=payload.notes,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()

    workout = _require_owned_workout_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_id=workout_id,
    )

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.patch(
    "/workouts/{workout_id}/exercises/{workout_exercise_id}",
    response_model=WorkoutResponse,
)
def update_existing_workout_exercise(
    workout_id: UUID,
    workout_exercise_id: UUID,
    payload: WorkoutExerciseUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    updates = _build_workout_exercise_updates(payload)

    if not updates:
        raise _request_validation_error()

    try:
        update_workout_exercise(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
            workout_exercise_id=workout_exercise_id,
            updates=updates,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()

    workout = _require_owned_workout_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_id=workout_id,
    )

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


@router.delete(
    "/workouts/{workout_id}/exercises/{workout_exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_workout_exercise(
    workout_id: UUID,
    workout_exercise_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> Response:
    try:
        remove_workout_exercise(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
            workout_exercise_id=workout_exercise_id,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


@router.put(
    "/workouts/{workout_id}/exercises/reorder",
    response_model=WorkoutResponse,
)
def reorder_existing_workout_exercises(
    workout_id: UUID,
    payload: WorkoutReorderRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutResponse:
    try:
        reorder_workout_exercises(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
            ordered_ids=payload.workout_exercise_ids,
        )
    except TrainingError as exc:
        _raise_training_api_error(exc)

    db_session.commit()

    workout = _require_owned_workout_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_id=workout_id,
    )

    return _build_workout_response(
        db_session=db_session,
        workout=workout,
        user_id=identity.user.id,
    )


def _build_exercise_response(
    exercise: Exercise,
) -> ExerciseResponse:
    return ExerciseResponse(
        id=exercise.id,
        name=exercise.name,
        origin=(
            ExerciseOrigin.CATALOG if exercise.owner_user_id is None else ExerciseOrigin.CUSTOM
        ),
        is_archived=exercise.is_archived,
        created_at=exercise.created_at,
        updated_at=exercise.updated_at,
    )


def _build_workout_summary_response(
    workout: Workout,
) -> WorkoutSummaryResponse:
    return WorkoutSummaryResponse(
        id=workout.id,
        name=workout.name,
        is_archived=workout.archived_at is not None,
        archived_at=workout.archived_at,
        created_at=workout.created_at,
        updated_at=workout.updated_at,
    )


def _build_workout_response(
    *,
    db_session: DatabaseSessionDependency,
    workout: Workout,
    user_id: UUID,
) -> WorkoutResponse:
    workout_exercises = list_workout_exercises(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout.id,
    )

    return WorkoutResponse(
        **_build_workout_summary_response(workout).model_dump(),
        exercises=_build_workout_exercise_responses(
            db_session=db_session,
            workout_exercises=workout_exercises,
        ),
    )


def _build_workout_exercise_responses(
    *,
    db_session: DatabaseSessionDependency,
    workout_exercises: list[WorkoutExercise],
) -> list[WorkoutExerciseResponse]:
    if not workout_exercises:
        return []

    exercise_ids = {workout_exercise.exercise_id for workout_exercise in workout_exercises}

    rows = db_session.execute(
        select(
            Exercise.id,
            Exercise.name,
        ).where(
            Exercise.id.in_(exercise_ids),
        )
    ).all()

    exercise_names = {exercise_id: exercise_name for exercise_id, exercise_name in rows}

    responses: list[WorkoutExerciseResponse] = []

    for workout_exercise in workout_exercises:
        exercise_name = exercise_names.get(workout_exercise.exercise_id)

        if exercise_name is None:
            raise RuntimeError("Workout exercise references a missing exercise.")

        responses.append(
            WorkoutExerciseResponse(
                id=workout_exercise.id,
                exercise_id=workout_exercise.exercise_id,
                exercise_name=exercise_name,
                position=workout_exercise.position,
                target_sets=workout_exercise.target_sets,
                target_repetitions=(workout_exercise.target_repetitions),
                target_load=workout_exercise.target_load,
                target_load_unit=(
                    LoadUnit(workout_exercise.target_load_unit)
                    if workout_exercise.target_load_unit is not None
                    else None
                ),
                notes=workout_exercise.notes,
                created_at=workout_exercise.created_at,
                updated_at=workout_exercise.updated_at,
            )
        )

    return responses


def _build_workout_exercise_updates(
    payload: WorkoutExerciseUpdateRequest,
) -> WorkoutExerciseUpdateValues:
    updates: WorkoutExerciseUpdateValues = {}
    fields_set = payload.model_fields_set

    if "target_sets" in fields_set:
        updates["target_sets"] = payload.target_sets

    if "target_repetitions" in fields_set:
        updates["target_repetitions"] = payload.target_repetitions

    if "target_load" in fields_set:
        updates["target_load"] = payload.target_load

    if "target_load_unit" in fields_set:
        updates["target_load_unit"] = (
            payload.target_load_unit.value if payload.target_load_unit is not None else None
        )

    if "notes" in fields_set:
        updates["notes"] = payload.notes

    return updates


def _require_owned_workout_for_response(
    *,
    db_session: DatabaseSessionDependency,
    user_id: UUID,
    workout_id: UUID,
) -> Workout:
    workout = get_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
    )

    if workout is None:
        raise _workout_not_found_error()

    return workout


def _raise_training_api_error(
    exc: TrainingError,
) -> NoReturn:
    if isinstance(exc, WorkoutNotFoundError):
        raise _workout_not_found_error() from exc

    if isinstance(exc, WorkoutExerciseNotFoundError):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="workout_exercise_not_found",
            message="Workout exercise was not found.",
        ) from exc

    if isinstance(exc, ExerciseUnavailableError):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="exercise_unavailable",
            message="Exercise is unavailable.",
        ) from exc

    if isinstance(exc, WorkoutArchivedError):
        raise ApiError(
            status_code=status.HTTP_409_CONFLICT,
            code="workout_archived",
            message="Archived workout cannot be modified.",
        ) from exc

    if isinstance(
        exc,
        (
            InvalidWorkoutExerciseConfigurationError,
            InvalidWorkoutReorderError,
        ),
    ):
        raise _request_validation_error() from exc

    raise RuntimeError("Unhandled training domain error.") from exc


def _workout_not_found_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code="workout_not_found",
        message="Workout was not found.",
    )


def _request_validation_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        code="request_validation_error",
        message="Request validation failed.",
    )
