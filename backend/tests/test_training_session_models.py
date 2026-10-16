from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import (
    Exercise,
    ExerciseExecution,
    SetExecution,
    Workout,
    WorkoutExercise,
    WorkoutSession,
)


@pytest.fixture
def db_session(database_engine: Engine) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        expire_on_commit=False,
    )

    try:
        yield session
    finally:
        session.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()


def create_user(
    db_session: Session,
    *,
    name: str = "Session User",
) -> User:
    user = User(
        name=name,
        email=f"session-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_planned_workout(
    db_session: Session,
    *,
    user: User,
) -> tuple[Workout, Exercise, WorkoutExercise]:
    exercise = Exercise(
        name="Barbell Bench Press",
    )
    workout = Workout(
        user_id=user.id,
        name="Push Day",
    )

    db_session.add_all(
        [
            exercise,
            workout,
        ]
    )
    db_session.flush()

    workout_exercise = WorkoutExercise(
        workout_id=workout.id,
        exercise_id=exercise.id,
        position=1,
        target_sets=4,
        target_repetitions=10,
        target_load=Decimal("60.00"),
        target_load_unit="kg",
        notes="Controlled eccentric.",
    )

    db_session.add(workout_exercise)
    db_session.flush()

    return workout, exercise, workout_exercise


def create_active_session(
    db_session: Session,
    *,
    user: User,
    workout: Workout,
) -> WorkoutSession:
    workout_session = WorkoutSession(
        user_id=user.id,
        source_workout_id=workout.id,
        workout_name=workout.name,
    )

    db_session.add(workout_session)
    db_session.flush()

    return workout_session


def test_active_workout_session_belongs_to_user_and_source_workout(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )

    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    persisted = db_session.scalar(
        select(WorkoutSession).where(
            WorkoutSession.id == workout_session.id,
        )
    )

    assert persisted is not None
    assert persisted.user_id == user.id
    assert persisted.source_workout_id == workout.id
    assert persisted.workout_name == "Push Day"
    assert persisted.status == "active"
    assert persisted.completed_at is None
    assert persisted.cancelled_at is None


def test_user_cannot_have_two_active_workout_sessions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )

    first_session = WorkoutSession(
        user_id=user.id,
        source_workout_id=workout.id,
        workout_name=workout.name,
    )
    second_session = WorkoutSession(
        user_id=user.id,
        source_workout_id=workout.id,
        workout_name=workout.name,
    )

    db_session.add(first_session)
    db_session.flush()

    db_session.add(second_session)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_different_users_can_have_active_sessions(
    db_session: Session,
) -> None:
    first_user = create_user(
        db_session,
        name="First User",
    )
    second_user = create_user(
        db_session,
        name="Second User",
    )

    first_workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=first_user,
    )

    second_workout = Workout(
        user_id=second_user.id,
        name="Second Workout",
    )
    db_session.add(second_workout)
    db_session.flush()

    db_session.add_all(
        [
            WorkoutSession(
                user_id=first_user.id,
                source_workout_id=first_workout.id,
                workout_name=first_workout.name,
            ),
            WorkoutSession(
                user_id=second_user.id,
                source_workout_id=second_workout.id,
                workout_name=second_workout.name,
            ),
        ]
    )
    db_session.flush()

    active_sessions = db_session.scalars(
        select(WorkoutSession).where(
            WorkoutSession.status == "active",
        )
    ).all()

    assert len(active_sessions) == 2


def test_user_can_have_multiple_completed_workout_sessions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    completed_at = datetime.now(UTC)

    db_session.add_all(
        [
            WorkoutSession(
                user_id=user.id,
                source_workout_id=workout.id,
                workout_name=workout.name,
                status="completed",
                completed_at=completed_at,
            ),
            WorkoutSession(
                user_id=user.id,
                source_workout_id=workout.id,
                workout_name=workout.name,
                status="completed",
                completed_at=completed_at,
            ),
        ]
    )
    db_session.flush()

    completed_sessions = db_session.scalars(
        select(WorkoutSession).where(
            WorkoutSession.user_id == user.id,
            WorkoutSession.status == "completed",
        )
    ).all()

    assert len(completed_sessions) == 2


@pytest.mark.parametrize(
    (
        "status",
        "completed_at",
        "cancelled_at",
    ),
    [
        (
            "active",
            datetime.now(UTC),
            None,
        ),
        (
            "active",
            None,
            datetime.now(UTC),
        ),
        (
            "completed",
            None,
            None,
        ),
        (
            "cancelled",
            None,
            None,
        ),
        (
            "completed",
            datetime.now(UTC),
            datetime.now(UTC),
        ),
    ],
)
def test_workout_session_rejects_invalid_lifecycle_state(
    db_session: Session,
    status: str,
    completed_at: datetime | None,
    cancelled_at: datetime | None,
) -> None:
    user = create_user(db_session)
    workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )

    workout_session = WorkoutSession(
        user_id=user.id,
        source_workout_id=workout.id,
        workout_name=workout.name,
        status=status,
        completed_at=completed_at,
        cancelled_at=cancelled_at,
    )

    db_session.add(workout_session)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_exercise_execution_preserves_planned_snapshot(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, exercise, workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    execution = ExerciseExecution(
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

    db_session.add(execution)
    db_session.flush()

    workout.name = "Changed Workout"
    exercise.name = "Changed Exercise"
    workout_exercise.target_sets = 5
    workout_exercise.target_repetitions = 8
    workout_exercise.target_load = Decimal("70.00")
    workout_exercise.notes = "Changed plan."

    db_session.flush()

    persisted = db_session.scalar(
        select(ExerciseExecution).where(
            ExerciseExecution.id == execution.id,
        )
    )

    assert persisted is not None
    assert persisted.exercise_name == "Barbell Bench Press"
    assert persisted.position == 1
    assert persisted.planned_sets == 4
    assert persisted.planned_repetitions == 10
    assert persisted.planned_load == Decimal("60.00")
    assert persisted.planned_load_unit == "kg"
    assert persisted.planned_notes == "Controlled eccentric."


def test_deleting_source_workout_preserves_session_history(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, _exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    workout_id = workout.id
    workout_session_id = workout_session.id

    db_session.execute(
        delete(Workout).where(
            Workout.id == workout_id,
        )
    )
    db_session.flush()
    db_session.expire_all()

    persisted_session = db_session.scalar(
        select(WorkoutSession).where(
            WorkoutSession.id == workout_session_id,
        )
    )

    assert persisted_session is not None
    assert persisted_session.source_workout_id is None
    assert persisted_session.workout_name == "Push Day"


def test_set_execution_persists_actual_performance(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, exercise, workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    execution = ExerciseExecution(
        workout_session_id=workout_session.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        position=1,
        planned_sets=workout_exercise.target_sets,
        planned_repetitions=workout_exercise.target_repetitions,
        planned_load=workout_exercise.target_load,
        planned_load_unit=workout_exercise.target_load_unit,
    )
    db_session.add(execution)
    db_session.flush()

    set_execution = SetExecution(
        exercise_execution_id=execution.id,
        position=1,
        repetitions=9,
        load=Decimal("62.50"),
        load_unit="kg",
    )

    db_session.add(set_execution)
    db_session.flush()

    persisted = db_session.scalar(
        select(SetExecution).where(
            SetExecution.id == set_execution.id,
        )
    )

    assert persisted is not None
    assert persisted.position == 1
    assert persisted.repetitions == 9
    assert persisted.load == Decimal("62.50")
    assert persisted.load_unit == "kg"


def test_session_cannot_have_duplicate_exercise_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    db_session.add_all(
        [
            ExerciseExecution(
                workout_session_id=workout_session.id,
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                position=1,
            ),
            ExerciseExecution(
                workout_session_id=workout_session.id,
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                position=1,
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_exercise_execution_cannot_have_duplicate_set_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    execution = ExerciseExecution(
        workout_session_id=workout_session.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        position=1,
    )
    db_session.add(execution)
    db_session.flush()

    db_session.add_all(
        [
            SetExecution(
                exercise_execution_id=execution.id,
                position=1,
                repetitions=10,
            ),
            SetExecution(
                exercise_execution_id=execution.id,
                position=1,
                repetitions=8,
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize(
    (
        "repetitions",
        "load",
        "load_unit",
    ),
    [
        (
            0,
            None,
            None,
        ),
        (
            10,
            Decimal("-1.00"),
            "kg",
        ),
        (
            10,
            None,
            "kg",
        ),
        (
            10,
            Decimal("20.00"),
            "oz",
        ),
    ],
)
def test_set_execution_rejects_invalid_performance_values(
    db_session: Session,
    repetitions: int,
    load: Decimal | None,
    load_unit: str | None,
) -> None:
    user = create_user(db_session)
    workout, exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    execution = ExerciseExecution(
        workout_session_id=workout_session.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        position=1,
    )
    db_session.add(execution)
    db_session.flush()

    set_execution = SetExecution(
        exercise_execution_id=execution.id,
        position=1,
        repetitions=repetitions,
        load=load,
        load_unit=load_unit,
    )

    db_session.add(set_execution)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_deleting_session_removes_execution_records(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, exercise, _workout_exercise = create_planned_workout(
        db_session,
        user=user,
    )
    workout_session = create_active_session(
        db_session,
        user=user,
        workout=workout,
    )

    execution = ExerciseExecution(
        workout_session_id=workout_session.id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        position=1,
    )
    db_session.add(execution)
    db_session.flush()

    set_execution = SetExecution(
        exercise_execution_id=execution.id,
        position=1,
        repetitions=10,
        load=Decimal("60.00"),
        load_unit="kg",
    )
    db_session.add(set_execution)
    db_session.flush()

    workout_session_id = workout_session.id
    execution_id = execution.id
    set_execution_id = set_execution.id

    db_session.execute(
        delete(WorkoutSession).where(
            WorkoutSession.id == workout_session_id,
        )
    )
    db_session.flush()

    persisted_execution = db_session.scalar(
        select(ExerciseExecution).where(
            ExerciseExecution.id == execution_id,
        )
    )
    persisted_set = db_session.scalar(
        select(SetExecution).where(
            SetExecution.id == set_execution_id,
        )
    )

    assert persisted_execution is None
    assert persisted_set is None
