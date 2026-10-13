from datetime import UTC, datetime
from decimal import Decimal
from typing import TypedDict
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from fitmap.training.models import Exercise, Workout, WorkoutExercise


class TrainingError(Exception):
    pass


class ExerciseUnavailableError(TrainingError):
    pass


class WorkoutNotFoundError(TrainingError):
    pass


class WorkoutArchivedError(TrainingError):
    pass


class WorkoutExerciseNotFoundError(TrainingError):
    pass


class InvalidWorkoutExerciseConfigurationError(TrainingError):
    pass


class InvalidWorkoutReorderError(TrainingError):
    pass


class WorkoutExerciseUpdateValues(TypedDict, total=False):
    target_sets: int | None
    target_repetitions: int | None
    target_load: Decimal | None
    target_load_unit: str | None
    notes: str | None


def list_available_exercises(
    *,
    db_session: Session,
    user_id: UUID,
) -> list[Exercise]:
    statement = (
        select(Exercise)
        .where(
            Exercise.is_archived.is_(False),
            or_(
                Exercise.owner_user_id.is_(None),
                Exercise.owner_user_id == user_id,
            ),
        )
        .order_by(
            Exercise.name.asc(),
            Exercise.id.asc(),
        )
    )

    return list(db_session.scalars(statement).all())


def get_available_exercise(
    *,
    db_session: Session,
    user_id: UUID,
    exercise_id: UUID,
) -> Exercise | None:
    return db_session.scalar(
        select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.is_archived.is_(False),
            or_(
                Exercise.owner_user_id.is_(None),
                Exercise.owner_user_id == user_id,
            ),
        )
    )


def create_custom_exercise(
    *,
    db_session: Session,
    user_id: UUID,
    name: str,
) -> Exercise:
    exercise = Exercise(
        owner_user_id=user_id,
        name=name,
    )

    db_session.add(exercise)
    db_session.flush()

    return exercise


def list_workouts(
    *,
    db_session: Session,
    user_id: UUID,
    include_archived: bool = False,
) -> list[Workout]:
    statement = select(Workout).where(
        Workout.user_id == user_id,
    )

    if not include_archived:
        statement = statement.where(
            Workout.archived_at.is_(None),
        )

    statement = statement.order_by(
        Workout.created_at.desc(),
        Workout.id.desc(),
    )

    return list(db_session.scalars(statement).all())


def get_owned_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    for_update: bool = False,
) -> Workout | None:
    statement = select(Workout).where(
        Workout.id == workout_id,
        Workout.user_id == user_id,
    )

    if for_update:
        statement = statement.with_for_update()

    return db_session.scalar(statement)


def create_workout(
    *,
    db_session: Session,
    user_id: UUID,
    name: str,
) -> Workout:
    workout = Workout(
        user_id=user_id,
        name=name,
    )

    db_session.add(workout)
    db_session.flush()

    return workout


def rename_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    name: str,
) -> Workout:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    _require_active_workout(workout)

    workout.name = name
    db_session.add(workout)
    db_session.flush()

    return workout


def archive_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
) -> Workout:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    if workout.archived_at is None:
        workout.archived_at = datetime.now(UTC)
        db_session.add(workout)
        db_session.flush()

    return workout


def restore_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
) -> Workout:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    if workout.archived_at is not None:
        workout.archived_at = None
        db_session.add(workout)
        db_session.flush()

    return workout


def list_workout_exercises(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
) -> list[WorkoutExercise]:
    _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
    )

    return _list_workout_exercises(
        db_session=db_session,
        workout_id=workout_id,
    )


def add_exercise_to_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    exercise_id: UUID,
    target_sets: int | None,
    target_repetitions: int | None,
    target_load: Decimal | None,
    target_load_unit: str | None,
    notes: str | None,
) -> WorkoutExercise:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    _require_active_workout(workout)

    exercise = get_available_exercise(
        db_session=db_session,
        user_id=user_id,
        exercise_id=exercise_id,
    )

    if exercise is None:
        raise ExerciseUnavailableError("Exercise is unavailable to this user.")

    _validate_load_configuration(
        target_load=target_load,
        target_load_unit=target_load_unit,
    )

    maximum_position = db_session.scalar(
        select(func.max(WorkoutExercise.position)).where(
            WorkoutExercise.workout_id == workout.id,
        )
    )

    next_position = 1 if maximum_position is None else maximum_position + 1

    workout_exercise = WorkoutExercise(
        workout_id=workout.id,
        exercise_id=exercise.id,
        position=next_position,
        target_sets=target_sets,
        target_repetitions=target_repetitions,
        target_load=target_load,
        target_load_unit=target_load_unit,
        notes=notes,
    )

    db_session.add(workout_exercise)
    db_session.flush()

    return workout_exercise


def update_workout_exercise(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    workout_exercise_id: UUID,
    updates: WorkoutExerciseUpdateValues,
) -> WorkoutExercise:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    _require_active_workout(workout)

    workout_exercise = _require_workout_exercise(
        db_session=db_session,
        workout_id=workout.id,
        workout_exercise_id=workout_exercise_id,
        for_update=True,
    )

    target_load = updates.get("target_load", workout_exercise.target_load)
    target_load_unit = updates.get("target_load_unit", workout_exercise.target_load_unit)

    _validate_load_configuration(
        target_load=target_load,
        target_load_unit=target_load_unit,
    )

    if "target_sets" in updates:
        workout_exercise.target_sets = updates["target_sets"]

    if "target_repetitions" in updates:
        workout_exercise.target_repetitions = updates["target_repetitions"]

    if "target_load" in updates:
        workout_exercise.target_load = updates["target_load"]

    if "target_load_unit" in updates:
        workout_exercise.target_load_unit = updates["target_load_unit"]

    if "notes" in updates:
        workout_exercise.notes = updates["notes"]

    db_session.add(workout_exercise)
    db_session.flush()

    return workout_exercise


def remove_workout_exercise(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    workout_exercise_id: UUID,
) -> None:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    _require_active_workout(workout)

    workout_exercise = _require_workout_exercise(
        db_session=db_session,
        workout_id=workout.id,
        workout_exercise_id=workout_exercise_id,
        for_update=True,
    )

    db_session.delete(workout_exercise)
    db_session.flush()

    remaining = _list_workout_exercises(
        db_session=db_session,
        workout_id=workout.id,
        for_update=True,
    )

    _assign_positions(
        db_session=db_session,
        workout_exercises=remaining,
        ordered_ids=[item.id for item in remaining],
    )


def reorder_workout_exercises(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    ordered_ids: list[UUID],
) -> list[WorkoutExercise]:
    workout = _require_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=True,
    )

    _require_active_workout(workout)

    workout_exercises = _list_workout_exercises(
        db_session=db_session,
        workout_id=workout.id,
        for_update=True,
    )

    current_ids = {item.id for item in workout_exercises}

    requested_ids = set(ordered_ids)

    if (
        len(ordered_ids) != len(workout_exercises)
        or len(requested_ids) != len(ordered_ids)
        or requested_ids != current_ids
    ):
        raise InvalidWorkoutReorderError(
            "Reorder request must contain every workout exercise exactly once."
        )

    _assign_positions(
        db_session=db_session,
        workout_exercises=workout_exercises,
        ordered_ids=ordered_ids,
    )

    return _list_workout_exercises(
        db_session=db_session,
        workout_id=workout.id,
    )


def _require_owned_workout(
    *,
    db_session: Session,
    user_id: UUID,
    workout_id: UUID,
    for_update: bool = False,
) -> Workout:
    workout = get_owned_workout(
        db_session=db_session,
        user_id=user_id,
        workout_id=workout_id,
        for_update=for_update,
    )

    if workout is None:
        raise WorkoutNotFoundError("Workout was not found.")

    return workout


def _require_active_workout(
    workout: Workout,
) -> None:
    if workout.archived_at is not None:
        raise WorkoutArchivedError("Archived workout cannot be modified.")


def _require_workout_exercise(
    *,
    db_session: Session,
    workout_id: UUID,
    workout_exercise_id: UUID,
    for_update: bool = False,
) -> WorkoutExercise:
    statement = select(WorkoutExercise).where(
        WorkoutExercise.id == workout_exercise_id,
        WorkoutExercise.workout_id == workout_id,
    )

    if for_update:
        statement = statement.with_for_update()

    workout_exercise = db_session.scalar(statement)

    if workout_exercise is None:
        raise WorkoutExerciseNotFoundError("Workout exercise was not found.")

    return workout_exercise


def _list_workout_exercises(
    *,
    db_session: Session,
    workout_id: UUID,
    for_update: bool = False,
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

    if for_update:
        statement = statement.with_for_update()

    return list(db_session.scalars(statement).all())


def _validate_load_configuration(
    *,
    target_load: Decimal | None,
    target_load_unit: str | None,
) -> None:
    if (target_load is None) != (target_load_unit is None):
        raise InvalidWorkoutExerciseConfigurationError(
            "Target load and target load unit must be provided together."
        )

    if target_load_unit not in {
        None,
        "kg",
        "lb",
    }:
        raise InvalidWorkoutExerciseConfigurationError("Unsupported target load unit.")


def _assign_positions(
    *,
    db_session: Session,
    workout_exercises: list[WorkoutExercise],
    ordered_ids: list[UUID],
) -> None:
    if not workout_exercises:
        return

    by_id = {item.id: item for item in workout_exercises}

    maximum_position = max(item.position for item in workout_exercises)

    for offset, workout_exercise in enumerate(
        workout_exercises,
        start=1,
    ):
        workout_exercise.position = maximum_position + offset
        db_session.add(workout_exercise)

    db_session.flush()

    for position, workout_exercise_id in enumerate(
        ordered_ids,
        start=1,
    ):
        workout_exercise = by_id.get(workout_exercise_id)

        if workout_exercise is None:
            raise InvalidWorkoutReorderError("Workout exercise is not part of this workout.")

        workout_exercise.position = position
        db_session.add(workout_exercise)

    db_session.flush()
