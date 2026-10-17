from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import Exercise, Workout
from fitmap.training.planning import (
    WorkoutNotFoundError,
    add_exercise_to_workout,
    archive_workout,
    create_workout,
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
    list_session_exercise_executions,
    start_workout_session,
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
        email=f"training-session-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_exercise(
    db_session: Session,
    *,
    name: str,
) -> Exercise:
    exercise = Exercise(
        name=name,
    )

    db_session.add(exercise)
    db_session.flush()

    return exercise


def create_configured_workout(
    db_session: Session,
    *,
    user: User,
    name: str = "Push Day",
) -> tuple[Workout, Exercise, Exercise]:
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name=name,
    )

    first_exercise = create_exercise(
        db_session,
        name="Barbell Bench Press",
    )
    second_exercise = create_exercise(
        db_session,
        name="Overhead Press",
    )

    add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=first_exercise.id,
        target_sets=4,
        target_repetitions=10,
        target_load=Decimal("60.00"),
        target_load_unit="kg",
        notes="Controlled eccentric.",
    )

    add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=second_exercise.id,
        target_sets=3,
        target_repetitions=8,
        target_load=Decimal("30.00"),
        target_load_unit="kg",
        notes=None,
    )

    return workout, first_exercise, second_exercise


def test_start_session_creates_active_session_with_planned_snapshots(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, first_exercise, second_exercise = create_configured_workout(
        db_session,
        user=user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    assert workout_session.user_id == user.id
    assert workout_session.source_workout_id == workout.id
    assert workout_session.workout_name == "Push Day"
    assert workout_session.status == "active"
    assert workout_session.completed_at is None
    assert workout_session.cancelled_at is None

    executions = list_session_exercise_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    assert len(executions) == 2

    first = executions[0]

    assert first.exercise_id == first_exercise.id
    assert first.exercise_name == "Barbell Bench Press"
    assert first.position == 1
    assert first.planned_sets == 4
    assert first.planned_repetitions == 10
    assert first.planned_load == Decimal("60.00")
    assert first.planned_load_unit == "kg"
    assert first.planned_notes == "Controlled eccentric."
    assert first.is_completed is False

    second = executions[1]

    assert second.exercise_id == second_exercise.id
    assert second.exercise_name == "Overhead Press"
    assert second.position == 2
    assert second.planned_sets == 3
    assert second.planned_repetitions == 8
    assert second.planned_load == Decimal("30.00")
    assert second.planned_load_unit == "kg"
    assert second.is_completed is False


def test_empty_workout_cannot_start_session(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Empty Workout",
    )

    with pytest.raises(WorkoutSessionSourceEmptyError):
        start_workout_session(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
        )


def test_archived_workout_cannot_start_session(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
    )

    archive_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    with pytest.raises(WorkoutSessionSourceUnavailableError):
        start_workout_session(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
        )


def test_user_cannot_start_another_users_workout(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Owner",
    )
    other_user = create_user(
        db_session,
        name="Other User",
    )

    workout, _first, _second = create_configured_workout(
        db_session,
        user=owner,
    )

    with pytest.raises(WorkoutNotFoundError):
        start_workout_session(
            db_session=db_session,
            user_id=other_user.id,
            workout_id=workout.id,
        )


def test_user_cannot_start_second_active_session(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
        name="First Workout",
    )

    second_workout, _third, _fourth = create_configured_workout(
        db_session,
        user=user,
        name="Second Workout",
    )

    start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=first_workout.id,
    )

    with pytest.raises(ActiveWorkoutSessionExistsError):
        start_workout_session(
            db_session=db_session,
            user_id=user.id,
            workout_id=second_workout.id,
        )


def test_active_session_is_isolated_between_users(
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

    workout, _first, _second = create_configured_workout(
        db_session,
        user=first_user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=first_user.id,
        workout_id=workout.id,
    )

    first_active = get_active_workout_session(
        db_session=db_session,
        user_id=first_user.id,
    )
    second_active = get_active_workout_session(
        db_session=db_session,
        user_id=second_user.id,
    )

    assert first_active is not None
    assert first_active.id == workout_session.id
    assert second_active is None


def test_get_owned_session_does_not_expose_another_users_session(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Owner",
    )
    other_user = create_user(
        db_session,
        name="Other User",
    )

    workout, _first, _second = create_configured_workout(
        db_session,
        user=owner,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=owner.id,
        workout_id=workout.id,
    )

    result = get_owned_workout_session(
        db_session=db_session,
        user_id=other_user.id,
        workout_session_id=workout_session.id,
    )

    assert result is None

    with pytest.raises(WorkoutSessionNotFoundError):
        list_session_exercise_executions(
            db_session=db_session,
            user_id=other_user.id,
            workout_session_id=workout_session.id,
        )


def test_active_session_can_be_finished(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    completed = finish_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    assert completed.status == "completed"
    assert completed.completed_at is not None
    assert completed.cancelled_at is None

    active_session = get_active_workout_session(
        db_session=db_session,
        user_id=user.id,
    )

    assert active_session is None


def test_active_session_can_be_cancelled(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    cancelled = cancel_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    assert cancelled.status == "cancelled"
    assert cancelled.completed_at is None
    assert cancelled.cancelled_at is not None

    active_session = get_active_workout_session(
        db_session=db_session,
        user_id=user.id,
    )

    assert active_session is None


def test_completed_session_cannot_be_finished_again(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    finish_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    with pytest.raises(WorkoutSessionNotActiveError):
        finish_workout_session(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
        )


def test_cancelled_session_cannot_be_cancelled_again(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    cancel_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    with pytest.raises(WorkoutSessionNotActiveError):
        cancel_workout_session(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
        )


def test_user_can_start_new_session_after_previous_session_finishes(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
        name="First Workout",
    )

    second_workout, _third, _fourth = create_configured_workout(
        db_session,
        user=user,
        name="Second Workout",
    )

    first_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=first_workout.id,
    )

    finish_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=first_session.id,
    )

    second_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=second_workout.id,
    )

    assert second_session.status == "active"
    assert second_session.source_workout_id == second_workout.id


def test_user_can_start_new_session_after_previous_session_is_cancelled(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_workout, _first, _second = create_configured_workout(
        db_session,
        user=user,
        name="First Workout",
    )

    second_workout, _third, _fourth = create_configured_workout(
        db_session,
        user=user,
        name="Second Workout",
    )

    first_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=first_workout.id,
    )

    cancel_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=first_session.id,
    )

    second_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=second_workout.id,
    )

    assert second_session.status == "active"
    assert second_session.source_workout_id == second_workout.id


def test_another_user_cannot_finish_private_session(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Owner",
    )
    other_user = create_user(
        db_session,
        name="Other User",
    )

    workout, _first, _second = create_configured_workout(
        db_session,
        user=owner,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=owner.id,
        workout_id=workout.id,
    )

    with pytest.raises(WorkoutSessionNotFoundError):
        finish_workout_session(
            db_session=db_session,
            user_id=other_user.id,
            workout_session_id=workout_session.id,
        )


def test_another_user_cannot_cancel_private_session(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Owner",
    )
    other_user = create_user(
        db_session,
        name="Other User",
    )

    workout, _first, _second = create_configured_workout(
        db_session,
        user=owner,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=owner.id,
        workout_id=workout.id,
    )

    with pytest.raises(WorkoutSessionNotFoundError):
        cancel_workout_session(
            db_session=db_session,
            user_id=other_user.id,
            workout_session_id=workout_session.id,
        )
