from typing import NoReturn
from uuid import UUID

from fastapi import APIRouter, Response, status
from sqlalchemy import select

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.training.execution import (
    ExerciseExecutionNotFoundError,
    InvalidSetExecutionError,
    SetExecutionNotFoundError,
    SetExecutionUpdateValues,
    add_set_execution,
    remove_set_execution,
    set_exercise_completion,
    update_exercise_execution_notes,
    update_set_execution,
    update_workout_session_notes,
)
from fitmap.training.models import (
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)
from fitmap.training.planning import (
    TrainingError,
    WorkoutNotFoundError,
)
from fitmap.training.schemas import LoadUnit
from fitmap.training.session_schemas import (
    ExerciseExecutionResponse,
    ExerciseExecutionUpdateRequest,
    SetExecutionCreateRequest,
    SetExecutionResponse,
    SetExecutionUpdateRequest,
    WorkoutSessionNotesUpdateRequest,
    WorkoutSessionResponse,
    WorkoutSessionStatus,
)
from fitmap.training.sessions import (
    ActiveWorkoutSessionExistsError,
    WorkoutSessionNotActiveError,
    WorkoutSessionNotFoundError,
    WorkoutSessionSourceEmptyError,
    WorkoutSessionSourceUnavailableError,
    cancel_workout_session,
    finish_workout_session,
    get_active_workout_session,
    get_owned_workout_session,
    start_workout_session,
)

router = APIRouter(
    prefix="/training",
    tags=["training"],
)


@router.post(
    "/workouts/{workout_id}/sessions",
    response_model=WorkoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_session(
    workout_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    try:
        workout_session = start_workout_session(
            db_session=db_session,
            user_id=identity.user.id,
            workout_id=workout_id,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()
    db_session.refresh(workout_session)

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.get(
    "/sessions/active",
    response_model=WorkoutSessionResponse | None,
)
def get_active_session(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse | None:
    workout_session = get_active_workout_session(
        db_session=db_session,
        user_id=identity.user.id,
    )

    if workout_session is None:
        return None

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.get(
    "/sessions/{workout_session_id}",
    response_model=WorkoutSessionResponse,
)
def get_session(
    workout_session_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    workout_session = get_owned_workout_session(
        db_session=db_session,
        user_id=identity.user.id,
        workout_session_id=workout_session_id,
    )

    if workout_session is None:
        raise _workout_session_not_found_error()

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.patch(
    "/sessions/{workout_session_id}",
    response_model=WorkoutSessionResponse,
)
def update_session(
    workout_session_id: UUID,
    payload: WorkoutSessionNotesUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    if "notes" not in payload.model_fields_set:
        raise _request_validation_error()

    try:
        update_workout_session_notes(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
            notes=payload.notes,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()

    workout_session = _require_owned_session_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_session_id=workout_session_id,
    )

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.post(
    "/sessions/{workout_session_id}/finish",
    response_model=WorkoutSessionResponse,
)
def finish_session(
    workout_session_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    try:
        workout_session = finish_workout_session(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()
    db_session.refresh(workout_session)

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.post(
    "/sessions/{workout_session_id}/cancel",
    response_model=WorkoutSessionResponse,
)
def cancel_session(
    workout_session_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    try:
        workout_session = cancel_workout_session(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()
    db_session.refresh(workout_session)

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.patch(
    "/sessions/{workout_session_id}/exercises/{exercise_execution_id}",
    response_model=WorkoutSessionResponse,
)
def update_session_exercise(
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    payload: ExerciseExecutionUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    fields_set = payload.model_fields_set

    if not fields_set:
        raise _request_validation_error()

    try:
        if "notes" in fields_set:
            update_exercise_execution_notes(
                db_session=db_session,
                user_id=identity.user.id,
                workout_session_id=workout_session_id,
                exercise_execution_id=exercise_execution_id,
                notes=payload.notes,
            )

        if "completed" in fields_set:
            if payload.completed is None:
                raise _request_validation_error()

            set_exercise_completion(
                db_session=db_session,
                user_id=identity.user.id,
                workout_session_id=workout_session_id,
                exercise_execution_id=exercise_execution_id,
                completed=payload.completed,
            )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()

    workout_session = _require_owned_session_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_session_id=workout_session_id,
    )

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.post(
    ("/sessions/{workout_session_id}/exercises/{exercise_execution_id}/sets"),
    response_model=WorkoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session_set(
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    payload: SetExecutionCreateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    try:
        add_set_execution(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
            exercise_execution_id=exercise_execution_id,
            repetitions=payload.repetitions,
            load=payload.load,
            load_unit=(payload.load_unit.value if payload.load_unit is not None else None),
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()

    workout_session = _require_owned_session_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_session_id=workout_session_id,
    )

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.patch(
    ("/sessions/{workout_session_id}/exercises/{exercise_execution_id}/sets/{set_execution_id}"),
    response_model=WorkoutSessionResponse,
)
def update_session_set(
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    set_execution_id: UUID,
    payload: SetExecutionUpdateRequest,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> WorkoutSessionResponse:
    updates = _build_set_execution_updates(payload)

    if not updates:
        raise _request_validation_error()

    try:
        update_set_execution(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
            exercise_execution_id=exercise_execution_id,
            set_execution_id=set_execution_id,
            updates=updates,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()

    workout_session = _require_owned_session_for_response(
        db_session=db_session,
        user_id=identity.user.id,
        workout_session_id=workout_session_id,
    )

    return _build_workout_session_response(
        db_session=db_session,
        workout_session=workout_session,
    )


@router.delete(
    ("/sessions/{workout_session_id}/exercises/{exercise_execution_id}/sets/{set_execution_id}"),
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_session_set(
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    set_execution_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> Response:
    try:
        remove_set_execution(
            db_session=db_session,
            user_id=identity.user.id,
            workout_session_id=workout_session_id,
            exercise_execution_id=exercise_execution_id,
            set_execution_id=set_execution_id,
        )
    except TrainingError as exc:
        _raise_session_api_error(exc)

    db_session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


def _build_workout_session_response(
    *,
    db_session: DatabaseSessionDependency,
    workout_session: WorkoutSession,
) -> WorkoutSessionResponse:
    exercise_executions = list(
        db_session.scalars(
            select(ExerciseExecution)
            .where(
                ExerciseExecution.workout_session_id == workout_session.id,
            )
            .order_by(
                ExerciseExecution.position.asc(),
                ExerciseExecution.id.asc(),
            )
        ).all()
    )

    exercise_execution_ids = {exercise_execution.id for exercise_execution in exercise_executions}

    set_executions: list[SetExecution] = []

    if exercise_execution_ids:
        set_executions = list(
            db_session.scalars(
                select(SetExecution)
                .where(SetExecution.exercise_execution_id.in_(exercise_execution_ids))
                .order_by(
                    SetExecution.exercise_execution_id.asc(),
                    SetExecution.position.asc(),
                    SetExecution.id.asc(),
                )
            ).all()
        )

    sets_by_exercise: dict[
        UUID,
        list[SetExecution],
    ] = {}

    for set_execution in set_executions:
        sets_by_exercise.setdefault(
            set_execution.exercise_execution_id,
            [],
        ).append(set_execution)

    exercise_responses = [
        _build_exercise_execution_response(
            exercise_execution=exercise_execution,
            set_executions=sets_by_exercise.get(
                exercise_execution.id,
                [],
            ),
        )
        for exercise_execution in exercise_executions
    ]

    return WorkoutSessionResponse(
        id=workout_session.id,
        source_workout_id=workout_session.source_workout_id,
        workout_name=workout_session.workout_name,
        status=WorkoutSessionStatus(workout_session.status),
        notes=workout_session.notes,
        started_at=workout_session.started_at,
        completed_at=workout_session.completed_at,
        cancelled_at=workout_session.cancelled_at,
        exercises=exercise_responses,
        created_at=workout_session.created_at,
        updated_at=workout_session.updated_at,
    )


def _build_exercise_execution_response(
    *,
    exercise_execution: ExerciseExecution,
    set_executions: list[SetExecution],
) -> ExerciseExecutionResponse:
    return ExerciseExecutionResponse(
        id=exercise_execution.id,
        exercise_id=exercise_execution.exercise_id,
        exercise_name=exercise_execution.exercise_name,
        position=exercise_execution.position,
        planned_sets=exercise_execution.planned_sets,
        planned_repetitions=(exercise_execution.planned_repetitions),
        planned_load=exercise_execution.planned_load,
        planned_load_unit=(
            LoadUnit(exercise_execution.planned_load_unit)
            if exercise_execution.planned_load_unit is not None
            else None
        ),
        planned_notes=exercise_execution.planned_notes,
        notes=exercise_execution.notes,
        is_completed=exercise_execution.is_completed,
        completed_at=exercise_execution.completed_at,
        sets=[_build_set_execution_response(set_execution) for set_execution in set_executions],
        created_at=exercise_execution.created_at,
        updated_at=exercise_execution.updated_at,
    )


def _build_set_execution_response(
    set_execution: SetExecution,
) -> SetExecutionResponse:
    return SetExecutionResponse(
        id=set_execution.id,
        position=set_execution.position,
        repetitions=set_execution.repetitions,
        load=set_execution.load,
        load_unit=(
            LoadUnit(set_execution.load_unit) if set_execution.load_unit is not None else None
        ),
        created_at=set_execution.created_at,
        updated_at=set_execution.updated_at,
    )


def _build_set_execution_updates(
    payload: SetExecutionUpdateRequest,
) -> SetExecutionUpdateValues:
    updates: SetExecutionUpdateValues = {}
    fields_set = payload.model_fields_set

    if "repetitions" in fields_set:
        if payload.repetitions is None:
            raise _request_validation_error()

        updates["repetitions"] = payload.repetitions

    if "load" in fields_set:
        updates["load"] = payload.load

    if "load_unit" in fields_set:
        updates["load_unit"] = payload.load_unit.value if payload.load_unit is not None else None

    return updates


def _require_owned_session_for_response(
    *,
    db_session: DatabaseSessionDependency,
    user_id: UUID,
    workout_session_id: UUID,
) -> WorkoutSession:
    workout_session = get_owned_workout_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
    )

    if workout_session is None:
        raise _workout_session_not_found_error()

    return workout_session


def _raise_session_api_error(
    exc: TrainingError,
) -> NoReturn:
    if isinstance(exc, WorkoutNotFoundError):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="workout_not_found",
            message="Workout was not found.",
        ) from exc

    if isinstance(exc, WorkoutSessionNotFoundError):
        raise _workout_session_not_found_error() from exc

    if isinstance(exc, ExerciseExecutionNotFoundError):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="exercise_execution_not_found",
            message="Exercise execution was not found.",
        ) from exc

    if isinstance(exc, SetExecutionNotFoundError):
        raise ApiError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="set_execution_not_found",
            message="Set execution was not found.",
        ) from exc

    if isinstance(exc, ActiveWorkoutSessionExistsError):
        raise ApiError(
            status_code=status.HTTP_409_CONFLICT,
            code="active_workout_session_exists",
            message="User already has an active workout session.",
        ) from exc

    if isinstance(exc, WorkoutSessionNotActiveError):
        raise ApiError(
            status_code=status.HTTP_409_CONFLICT,
            code="workout_session_not_active",
            message="Workout session is no longer active.",
        ) from exc

    if isinstance(exc, WorkoutSessionSourceEmptyError):
        raise ApiError(
            status_code=status.HTTP_409_CONFLICT,
            code="workout_session_source_empty",
            message=("Workout must contain at least one exercise before a session can start."),
        ) from exc

    if isinstance(exc, WorkoutSessionSourceUnavailableError):
        raise ApiError(
            status_code=status.HTTP_409_CONFLICT,
            code="workout_session_source_unavailable",
            message=str(exc),
        ) from exc

    if isinstance(exc, InvalidSetExecutionError):
        raise _request_validation_error() from exc

    raise RuntimeError("Unhandled workout session domain error.") from exc


def _workout_session_not_found_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_404_NOT_FOUND,
        code="workout_session_not_found",
        message="Workout session was not found.",
    )


def _request_validation_error() -> ApiError:
    return ApiError(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        code="request_validation_error",
        message="Request validation failed.",
    )
