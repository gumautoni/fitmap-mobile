from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.execution import (
    ExerciseExecutionNotFoundError,
    InvalidSetExecutionError,
    SetExecutionNotFoundError,
    SetExecutionUpdateValues,
    add_set_execution,
    list_set_executions,
    remove_set_execution,
    set_exercise_completion,
    update_exercise_execution_notes,
    update_set_execution,
    update_workout_session_notes,
)
from fitmap.training.models import (
    Exercise,
    ExerciseExecution,
    Workout,
    WorkoutSession,
)
from fitmap.training.planning import (
    add_exercise_to_workout,
    create_workout,
)
from fitmap.training.sessions import (
    WorkoutSessionNotActiveError,
    WorkoutSessionNotFoundError,
    cancel_workout_session,
    finish_workout_session,
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
    name: str = "Execution User",
) -> User:
    user = User(
        name=name,
        email=f"training-execution-{uuid4()}@example.com",
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


def create_active_session(
    db_session: Session,
    *,
    user: User,
) -> tuple[
    Workout,
    WorkoutSession,
    list[ExerciseExecution],
]:
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Push Day",
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
        target_load=None,
        target_load_unit=None,
        notes=None,
    )

    workout_session = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    executions = list_session_exercise_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    return workout, workout_session, executions


def test_set_execution_records_actual_performance(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=9,
        load=Decimal("62.50"),
        load_unit="kg",
    )

    assert set_execution.position == 1
    assert set_execution.repetitions == 9
    assert set_execution.load == Decimal("62.50")
    assert set_execution.load_unit == "kg"


def test_multiple_sets_receive_sequential_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    first = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=10,
        load=Decimal("60.00"),
        load_unit="kg",
    )
    second = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=9,
        load=Decimal("60.00"),
        load_unit="kg",
    )
    third = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=8,
        load=Decimal("60.00"),
        load_unit="kg",
    )

    assert [
        first.position,
        second.position,
        third.position,
    ] == [
        1,
        2,
        3,
    ]


def test_set_execution_can_be_recorded_without_load(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[1].id,
        repetitions=12,
        load=None,
        load_unit=None,
    )

    assert set_execution.repetitions == 12
    assert set_execution.load is None
    assert set_execution.load_unit is None


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
            Decimal("20.00"),
            None,
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
def test_add_set_rejects_invalid_execution_values(
    db_session: Session,
    repetitions: int,
    load: Decimal | None,
    load_unit: str | None,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    with pytest.raises(InvalidSetExecutionError):
        add_set_execution(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            repetitions=repetitions,
            load=load,
            load_unit=load_unit,
        )


def test_set_execution_can_be_corrected_during_active_session(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=8,
        load=Decimal("60.00"),
        load_unit="kg",
    )

    updates: SetExecutionUpdateValues = {
        "repetitions": 10,
        "load": Decimal("62.50"),
        "load_unit": "kg",
    }

    updated = update_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        set_execution_id=set_execution.id,
        updates=updates,
    )

    assert updated.repetitions == 10
    assert updated.load == Decimal("62.50")
    assert updated.load_unit == "kg"


def test_partial_set_update_preserves_other_values(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=8,
        load=Decimal("60.00"),
        load_unit="kg",
    )

    updates: SetExecutionUpdateValues = {
        "repetitions": 9,
    }

    updated = update_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        set_execution_id=set_execution.id,
        updates=updates,
    )

    assert updated.repetitions == 9
    assert updated.load == Decimal("60.00")
    assert updated.load_unit == "kg"


def test_invalid_partial_set_update_is_rejected(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=10,
        load=Decimal("60.00"),
        load_unit="kg",
    )

    updates: SetExecutionUpdateValues = {
        "load_unit": None,
    }

    with pytest.raises(InvalidSetExecutionError):
        update_set_execution(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            set_execution_id=set_execution.id,
            updates=updates,
        )


def test_removing_set_compacts_remaining_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    first = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=10,
        load=None,
        load_unit=None,
    )
    second = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=9,
        load=None,
        load_unit=None,
    )
    third = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=8,
        load=None,
        load_unit=None,
    )

    remove_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        set_execution_id=second.id,
    )

    remaining = list_set_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
    )

    assert [item.id for item in remaining] == [
        first.id,
        third.id,
    ]
    assert [item.position for item in remaining] == [
        1,
        2,
    ]


def test_session_and_exercise_notes_can_be_recorded(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    updated_session = update_workout_session_notes(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        notes="Good overall session.",
    )

    updated_exercise = update_exercise_execution_notes(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        notes="Last repetitions were difficult.",
    )

    assert updated_session.notes == "Good overall session."
    assert updated_exercise.notes == "Last repetitions were difficult."


def test_exercise_completion_can_be_marked_and_reopened(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    completed = set_exercise_completion(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        completed=True,
    )

    assert completed.is_completed is True
    assert completed.completed_at is not None

    reopened = set_exercise_completion(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        completed=False,
    )

    assert reopened.is_completed is False
    assert reopened.completed_at is None


def test_another_user_cannot_record_set_in_private_session(
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

    _workout, workout_session, executions = create_active_session(
        db_session,
        user=owner,
    )

    with pytest.raises(WorkoutSessionNotFoundError):
        add_set_execution(
            db_session=db_session,
            user_id=other_user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            repetitions=10,
            load=None,
            load_unit=None,
        )


def test_exercise_execution_must_belong_to_requested_session(
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

    _first_workout, first_session, _first_executions = create_active_session(
        db_session,
        user=first_user,
    )
    _second_workout, _second_session, second_executions = create_active_session(
        db_session,
        user=second_user,
    )

    with pytest.raises(ExerciseExecutionNotFoundError):
        add_set_execution(
            db_session=db_session,
            user_id=first_user.id,
            workout_session_id=first_session.id,
            exercise_execution_id=second_executions[0].id,
            repetitions=10,
            load=None,
            load_unit=None,
        )


def test_set_execution_must_belong_to_requested_exercise(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    set_execution = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=10,
        load=None,
        load_unit=None,
    )

    with pytest.raises(SetExecutionNotFoundError):
        update_set_execution(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[1].id,
            set_execution_id=set_execution.id,
            updates={
                "repetitions": 12,
            },
        )


def test_completed_session_rejects_execution_mutation(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    finish_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    with pytest.raises(WorkoutSessionNotActiveError):
        add_set_execution(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            repetitions=10,
            load=None,
            load_unit=None,
        )

    with pytest.raises(WorkoutSessionNotActiveError):
        update_exercise_execution_notes(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            notes="This must not be persisted.",
        )


def test_cancelled_session_rejects_execution_mutation(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    cancel_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    with pytest.raises(WorkoutSessionNotActiveError):
        set_exercise_completion(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            exercise_execution_id=executions[0].id,
            completed=True,
        )

    with pytest.raises(WorkoutSessionNotActiveError):
        update_workout_session_notes(
            db_session=db_session,
            user_id=user.id,
            workout_session_id=workout_session.id,
            notes="This must not be persisted.",
        )


def test_completed_session_preserves_recorded_sets_for_history(
    db_session: Session,
) -> None:
    user = create_user(db_session)
    _workout, workout_session, executions = create_active_session(
        db_session,
        user=user,
    )

    recorded_set = add_set_execution(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        repetitions=9,
        load=Decimal("62.50"),
        load_unit="kg",
    )

    set_exercise_completion(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
        completed=True,
    )

    finish_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
    )

    historical_sets = list_set_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=workout_session.id,
        exercise_execution_id=executions[0].id,
    )

    assert len(historical_sets) == 1
    assert historical_sets[0].id == recorded_set.id
    assert historical_sets[0].repetitions == 9
    assert historical_sets[0].load == Decimal("62.50")
    assert historical_sets[0].load_unit == "kg"
