from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.training.models import (
    Exercise,
    ExerciseExecution,
    WorkoutExercise,
    WorkoutSession,
)
from fitmap.training.planning import (
    TrainingError,
    WorkoutNotFoundError,
    get_owned_workout,
)


class ActiveWorkoutSessionExistsError(TrainingError):
    pass


class WorkoutSessionNotFoundError(TrainingError):
    pass


class WorkoutSessionNotActiveError(TrainingError):
    pass


class WorkoutSessionSourceEmptyError(TrainingError):
    pass


class WorkoutSessionSourceUnavailableError(TrainingError):
    pass


def get_active_workout_session(
    *,
    db_session: Session,
    user_id: UUID,
    for_update: bool = False,
) -> WorkoutSession | None:
    statement = select(WorkoutSession).where(
        WorkoutSession.user_id == user_id,
        WorkoutSession.status == "active",
    )

    if for_update:
        statement = statement.with_for_update()

    return db_session.scalar(statement)


def get_owned_workout_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
    for_update: bool = False,
) -> WorkoutSession | None:
    statement = select(WorkoutSession).where(
        WorkoutSession.id == workout_session_id,
        WorkoutSession.user_id == user_id,
    )

    if for_update:
        statement = statement.with_for_update()

    return db_session.scalar(statement)


def start_workout_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
) -> WorkoutSession:
    active_session = get_active_workout_session(
        db_session=db_session,
        user_id=user_id,
        for_update=True,
    )

    if active_session is not None:
        raise ActiveWorkoutSessionExistsError("User already has an active workout session.")

    workout = get_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    if workout is None:
        raise WorkoutNotFoundError("Workout was not found.")

    if workout.archived_at is not None:
        raise WorkoutSessionSourceUnavailableError("Archived workout cannot start a session.")

    workout_exercises = _list_planned_workout_exercises(
        db_session=db_session,
        workout_id=workout.id,
    )

    if not workout_exercises:
        raise WorkoutSessionSourceEmptyError(
            "Workout must contain at least one exercise before a session can start."
        )

    workout_session = WorkoutSession(
        user_id=user_id,
        source_workout_id=workout.id,
        workout_name=workout.name,
    )

    db_session.add(workout_session)
    db_session.flush()

    exercise_executions: list[ExerciseExecution] = []

    for workout_exercise in workout_exercises:
        exercise = db_session.get(
            Exercise,
            workout_exercise.exercise_id,
        )

        if exercise is None:
            raise WorkoutSessionSourceUnavailableError("Workout contains an unavailable exercise.")

        exercise_executions.append(
            ExerciseExecution(
                workout_session_id=workout_session.id,
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                position=workout_exercise.position,
                planned_sets=workout_exercise.target_sets,
                planned_repetitions=workout_exercise.target_repetitions,
                planned_load=workout_exercise.target_load,
                planned_load_unit=workout_exercise.target_load_unit,
                planned_notes=workout_exercise.notes,
            )
        )

    db_session.add_all(exercise_executions)
    db_session.flush()

    return workout_session


def list_session_exercise_executions(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
) -> list[ExerciseExecution]:
    _require_owned_workout_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
    )

    statement = (
        select(ExerciseExecution)
        .where(
            ExerciseExecution.workout_session_id == workout_session_id,
        )
        .order_by(
            ExerciseExecution.position.asc(),
            ExerciseExecution.id.asc(),
        )
    )

    return list(db_session.scalars(statement).all())


def finish_workout_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
) -> WorkoutSession:
    workout_session = _require_owned_workout_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    _require_active_session(workout_session)

    workout_session.status = "completed"
    workout_session.completed_at = datetime.now(UTC)
    workout_session.cancelled_at = None

    db_session.add(workout_session)
    db_session.flush()

    return workout_session


def cancel_workout_session(
    *,
    db_session: Session,
    user_id: UUID,
    workout_session_id: UUID,
) -> WorkoutSession:
    workout_session = _require_owned_workout_session(
        db_session=db_session,
        user_id=user_id,
        workout_session_id=workout_session_id,
        for_update=True,
    )

    _require_active_session(workout_session)

    workout_session.status = "cancelled"
    workout_session.completed_at = None
    workout_session.cancelled_at = datetime.now(UTC)

    db_session.add(workout_session)
    db_session.flush()

    return workout_session


def _require_owned_workout_session(
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


def _require_active_session(
    workout_session: WorkoutSession,
) -> None:
    if workout_session.status != "active":
        raise WorkoutSessionNotActiveError("Workout session is no longer active.")


def _list_planned_workout_exercises(
    *,
    db_session: Session,
    workout_id: UUID,
) -> list[WorkoutExercise]:
    statement = (
        select(WorkoutExercise)
        .where(
            WorkoutExercise.workout_id == workout_id,
        )
        .order_by(
            WorkoutExercise.position.asc(),
            WorkoutExercise.id.asc(),
        )
    )

    return list(db_session.scalars(statement).all())
