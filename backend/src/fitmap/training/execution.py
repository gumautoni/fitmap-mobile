from datetime import UTC, datetime
from decimal import Decimal
from typing import TypedDict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fitmap.training.models import (
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)
from fitmap.training.planning import TrainingError
from fitmap.training.sessions import (
    WorkoutSessionNotActiveError,
    WorkoutSessionNotFoundError,
    get_owned_workout_session,
)


class ExerciseExecutionNotFoundError(TrainingError):
    pass


class SetExecutionNotFoundError(TrainingError):
    pass


class InvalidSetExecutionError(TrainingError):
    pass


class SetExecutionUpdateValues(TypedDict, total=False):
    repetitions: int
    load: Decimal | None
    load_unit: str | None


def update_workout_session_notes(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    notes: str | None,
) -> WorkoutSession:
    workout_session = _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    workout_session.notes = notes

    db_session.add(workout_session)
    db_session.flush()

    return workout_session


def update_exercise_execution_notes(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    notes: str | None,
) -> ExerciseExecution:
    _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    exercise_execution = _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    exercise_execution.notes = notes

    db_session.add(exercise_execution)
    db_session.flush()

    return exercise_execution


def set_exercise_completion(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    completed: bool,
) -> ExerciseExecution:
    _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    exercise_execution = _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    exercise_execution.is_completed = completed
    exercise_execution.completed_at = datetime.now(UTC) if completed else None

    db_session.add(exercise_execution)
    db_session.flush()

    return exercise_execution


def list_set_executions(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
) -> list[SetExecution]:
    _require_owned_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
    )

    _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
    )

    return _list_set_executions(
        db_session=db_session,
        exercise_execution_id=exercise_execution_id,
    )


def add_set_execution(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    repetitions: int,
    load: Decimal | None,
    load_unit: str | None,
) -> SetExecution:
    _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    exercise_execution = _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    _validate_set_execution(
        repetitions=repetitions,
        load=load,
        load_unit=load_unit,
    )

    maximum_position = db_session.scalar(
        select(func.max(SetExecution.position)).where(
            SetExecution.exercise_execution_id == exercise_execution.id,
        )
    )

    next_position = 1 if maximum_position is None else maximum_position + 1

    set_execution = SetExecution(
        exercise_execution_id=exercise_execution.id,
        position=next_position,
        repetitions=repetitions,
        load=load,
        load_unit=load_unit,
    )

    db_session.add(set_execution)
    db_session.flush()

    return set_execution


def update_set_execution(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    set_execution_id: UUID,
    updates: SetExecutionUpdateValues,
) -> SetExecution:
    _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    set_execution = _require_set_execution(
        db_session=db_session,
        exercise_execution_id=exercise_execution_id,
        set_execution_id=set_execution_id,
        for_update=True,
    )

    repetitions = updates.get(
        "repetitions",
        set_execution.repetitions,
    )
    load = updates.get(
        "load",
        set_execution.load,
    )
    load_unit = updates.get(
        "load_unit",
        set_execution.load_unit,
    )

    _validate_set_execution(
        repetitions=repetitions,
        load=load,
        load_unit=load_unit,
    )

    if "repetitions" in updates:
        set_execution.repetitions = updates["repetitions"]

    if "load" in updates:
        set_execution.load = updates["load"]

    if "load_unit" in updates:
        set_execution.load_unit = updates["load_unit"]

    db_session.add(set_execution)
    db_session.flush()

    return set_execution


def remove_set_execution(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    set_execution_id: UUID,
) -> None:
    _require_owned_active_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    _require_exercise_execution(
        db_session=db_session,
        workout_session_id=workout_session_id,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    set_execution = _require_set_execution(
        db_session=db_session,
        exercise_execution_id=exercise_execution_id,
        set_execution_id=set_execution_id,
        for_update=True,
    )

    db_session.delete(set_execution)
    db_session.flush()

    remaining = _list_set_executions(
        db_session=db_session,
        exercise_execution_id=exercise_execution_id,
        for_update=True,
    )

    _compact_set_positions(
        db_session=db_session,
        set_executions=remaining,
    )


def _require_owned_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    for_update: bool = False,
) -> WorkoutSession:
    workout_session = get_owned_workout_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=for_update,
    )

    if workout_session is None:
        raise WorkoutSessionNotFoundError("Workout session was not found.")

    return workout_session


def _require_owned_active_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    for_update: bool = False,
) -> WorkoutSession:
    workout_session = _require_owned_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=for_update,
    )

    if workout_session.status != "active":
        raise WorkoutSessionNotActiveError("Workout session is no longer active.")

    return workout_session


def _require_exercise_execution(
    *,
    db_session: Session,
    workout_session_id: UUID,
    exercise_execution_id: UUID,
    for_update: bool = False,
) -> ExerciseExecution:
    statement = select(ExerciseExecution).where(
        ExerciseExecution.id == exercise_execution_id,
        ExerciseExecution.workout_session_id == workout_session_id,
    )

    if for_update:
        statement = statement.with_for_update()

    exercise_execution = db_session.scalar(statement)

    if exercise_execution is None:
        raise ExerciseExecutionNotFoundError("Exercise execution was not found.")

    return exercise_execution


def _require_set_execution(
    *,
    db_session: Session,
    exercise_execution_id: UUID,
    set_execution_id: UUID,
    for_update: bool = False,
) -> SetExecution:
    statement = select(SetExecution).where(
        SetExecution.id == set_execution_id,
        SetExecution.exercise_execution_id == exercise_execution_id,
    )

    if for_update:
        statement = statement.with_for_update()

    set_execution = db_session.scalar(statement)

    if set_execution is None:
        raise SetExecutionNotFoundError("Set execution was not found.")

    return set_execution


def _list_set_executions(
    *,
    db_session: Session,
    exercise_execution_id: UUID,
    for_update: bool = False,
) -> list[SetExecution]:
    statement = (
        select(SetExecution)
        .where(
            SetExecution.exercise_execution_id == exercise_execution_id,
        )
        .order_by(
            SetExecution.position.asc(),
            SetExecution.id.asc(),
        )
    )

    if for_update:
        statement = statement.with_for_update()

    return list(db_session.scalars(statement).all())


def _validate_set_execution(
    *,
    repetitions: int,
    load: Decimal | None,
    load_unit: str | None,
) -> None:
    if repetitions < 1:
        raise InvalidSetExecutionError("Repetitions must be greater than zero.")

    if load is not None and load < 0:
        raise InvalidSetExecutionError("Load must not be negative.")

    if (load is None) != (load_unit is None):
        raise InvalidSetExecutionError("Load and load unit must be provided together.")

    if load_unit not in {
        None,
        "kg",
        "lb",
    }:
        raise InvalidSetExecutionError("Unsupported load unit.")


def _compact_set_positions(
    *,
    db_session: Session,
    set_executions: list[SetExecution],
) -> None:
    if not set_executions:
        return

    maximum_position = max(set_execution.position for set_execution in set_executions)

    for offset, set_execution in enumerate(
        set_executions,
        start=1,
    ):
        set_execution.position = maximum_position + offset
        db_session.add(set_execution)

    db_session.flush()

    for position, set_execution in enumerate(
        set_executions,
        start=1,
    ):
        set_execution.position = position
        db_session.add(set_execution)

    db_session.flush()
