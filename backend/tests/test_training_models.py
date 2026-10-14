from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine, delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import Exercise, Workout, WorkoutExercise


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
    name: str = "Training User",
) -> User:
    user = User(
        name=name,
        email=f"training-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def test_catalog_exercise_can_exist_without_user_owner(
    db_session: Session,
) -> None:
    exercise = Exercise(
        name="Barbell Bench Press",
    )

    db_session.add(exercise)
    db_session.flush()

    persisted = db_session.scalar(
        select(Exercise).where(
            Exercise.id == exercise.id,
        )
    )

    assert persisted is not None
    assert persisted.owner_user_id is None
    assert persisted.name == "Barbell Bench Press"
    assert persisted.is_archived is False


def test_custom_exercise_belongs_to_user(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        owner_user_id=user.id,
        name="Custom Cable Press",
    )

    db_session.add(exercise)
    db_session.flush()

    persisted = db_session.scalar(
        select(Exercise).where(
            Exercise.id == exercise.id,
        )
    )

    assert persisted is not None
    assert persisted.owner_user_id == user.id
    assert persisted.name == "Custom Cable Press"


def test_exercise_name_cannot_be_blank(
    db_session: Session,
) -> None:
    exercise = Exercise(
        name="   ",
    )

    db_session.add(exercise)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_workout_belongs_to_user_and_starts_active(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout = Workout(
        user_id=user.id,
        name="Push",
    )

    db_session.add(workout)
    db_session.flush()

    persisted = db_session.scalar(
        select(Workout).where(
            Workout.id == workout.id,
        )
    )

    assert persisted is not None
    assert persisted.user_id == user.id
    assert persisted.name == "Push"
    assert persisted.archived_at is None


def test_workout_name_cannot_be_blank(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout = Workout(
        user_id=user.id,
        name="   ",
    )

    db_session.add(workout)

    with pytest.raises(IntegrityError):
        db_session.flush()


def test_workout_exercise_persists_planned_configuration(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Barbell Bench Press",
    )
    workout = Workout(
        user_id=user.id,
        name="Push",
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
        target_repetitions=8,
        target_load=Decimal("60.00"),
        target_load_unit="kg",
        notes="Controlled eccentric phase.",
    )

    db_session.add(workout_exercise)
    db_session.flush()

    persisted = db_session.scalar(
        select(WorkoutExercise).where(
            WorkoutExercise.id == workout_exercise.id,
        )
    )

    assert persisted is not None
    assert persisted.workout_id == workout.id
    assert persisted.exercise_id == exercise.id
    assert persisted.position == 1
    assert persisted.target_sets == 4
    assert persisted.target_repetitions == 8
    assert persisted.target_load == Decimal("60.00")
    assert persisted.target_load_unit == "kg"
    assert persisted.notes == "Controlled eccentric phase."


def test_workout_exercise_allows_configuration_without_load(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Push-up",
    )
    workout = Workout(
        user_id=user.id,
        name="Bodyweight",
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
        target_sets=3,
        target_repetitions=12,
    )

    db_session.add(workout_exercise)
    db_session.flush()

    assert workout_exercise.target_load is None
    assert workout_exercise.target_load_unit is None


def test_workout_cannot_have_duplicate_exercise_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_exercise = Exercise(
        name="Barbell Bench Press",
    )
    second_exercise = Exercise(
        name="Incline Dumbbell Press",
    )
    workout = Workout(
        user_id=user.id,
        name="Push",
    )

    db_session.add_all(
        [
            first_exercise,
            second_exercise,
            workout,
        ]
    )
    db_session.flush()

    db_session.add_all(
        [
            WorkoutExercise(
                workout_id=workout.id,
                exercise_id=first_exercise.id,
                position=1,
            ),
            WorkoutExercise(
                workout_id=workout.id,
                exercise_id=second_exercise.id,
                position=1,
            ),
        ]
    )

    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize(
    (
        "position",
        "target_sets",
        "target_repetitions",
        "target_load",
        "target_load_unit",
    ),
    [
        (
            0,
            3,
            10,
            None,
            None,
        ),
        (
            1,
            0,
            10,
            None,
            None,
        ),
        (
            1,
            3,
            0,
            None,
            None,
        ),
        (
            1,
            3,
            10,
            Decimal("-1.00"),
            "kg",
        ),
        (
            1,
            3,
            10,
            Decimal("20.00"),
            "oz",
        ),
        (
            1,
            3,
            10,
            None,
            "kg",
        ),
    ],
)
def test_workout_exercise_rejects_invalid_planned_values(
    db_session: Session,
    position: int,
    target_sets: int,
    target_repetitions: int,
    target_load: Decimal | None,
    target_load_unit: str | None,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Squat",
    )
    workout = Workout(
        user_id=user.id,
        name="Legs",
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
        position=position,
        target_sets=target_sets,
        target_repetitions=target_repetitions,
        target_load=target_load,
        target_load_unit=target_load_unit,
    )

    db_session.add(workout_exercise)

    with pytest.raises(IntegrityError):
        db_session.flush()


@pytest.mark.parametrize(
    "unit",
    [
        "kg",
        "lb",
    ],
)
def test_workout_exercise_accepts_supported_load_units(
    db_session: Session,
    unit: str,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Leg Press",
    )
    workout = Workout(
        user_id=user.id,
        name="Legs",
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
        target_load=Decimal("100.00"),
        target_load_unit=unit,
    )

    db_session.add(workout_exercise)
    db_session.flush()

    assert workout_exercise.target_load == Decimal("100.00")
    assert workout_exercise.target_load_unit == unit


def test_referenced_exercise_cannot_be_deleted(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Lat Pulldown",
    )
    workout = Workout(
        user_id=user.id,
        name="Pull",
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
    )

    db_session.add(workout_exercise)
    db_session.flush()

    db_session.delete(exercise)
    db_session.flush()

    with pytest.raises(IntegrityError):
        db_session.execute(text("SET CONSTRAINTS workout_exercises_exercise_id_fkey IMMEDIATE"))


def test_deleting_workout_removes_workout_exercise_records(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = Exercise(
        name="Squat",
    )
    workout = Workout(
        user_id=user.id,
        name="Legs",
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
    )

    db_session.add(workout_exercise)
    db_session.flush()

    workout_id = workout.id

    db_session.execute(
        delete(Workout).where(
            Workout.id == workout_id,
        )
    )
    db_session.flush()

    persisted_workout_exercise = db_session.scalar(
        select(WorkoutExercise).where(
            WorkoutExercise.workout_id == workout_id,
        )
    )

    assert persisted_workout_exercise is None


def test_deleting_user_removes_owned_workouts_and_custom_exercises(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    custom_exercise = Exercise(
        owner_user_id=user.id,
        name="My Custom Exercise",
    )
    workout = Workout(
        user_id=user.id,
        name="My Workout",
    )

    db_session.add_all(
        [
            custom_exercise,
            workout,
        ]
    )
    db_session.flush()

    custom_exercise_id = custom_exercise.id
    workout_id = workout.id

    db_session.execute(
        delete(User).where(
            User.id == user.id,
        )
    )
    db_session.flush()

    persisted_custom_exercise = db_session.scalar(
        select(Exercise).where(
            Exercise.id == custom_exercise_id,
        )
    )
    persisted_workout = db_session.scalar(
        select(Workout).where(
            Workout.id == workout_id,
        )
    )

    assert persisted_custom_exercise is None
    assert persisted_workout is None


def test_deleting_user_removes_workout_using_owned_custom_exercise(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    custom_exercise = Exercise(
        owner_user_id=user.id,
        name="My Custom Exercise",
    )
    workout = Workout(
        user_id=user.id,
        name="My Workout",
    )

    db_session.add_all(
        [
            custom_exercise,
            workout,
        ]
    )
    db_session.flush()

    workout_exercise = WorkoutExercise(
        workout_id=workout.id,
        exercise_id=custom_exercise.id,
        position=1,
    )

    db_session.add(workout_exercise)
    db_session.flush()

    custom_exercise_id = custom_exercise.id
    workout_id = workout.id
    workout_exercise_id = workout_exercise.id

    db_session.execute(
        delete(User).where(
            User.id == user.id,
        )
    )
    db_session.flush()

    db_session.execute(text("SET CONSTRAINTS workout_exercises_exercise_id_fkey IMMEDIATE"))

    persisted_custom_exercise = db_session.scalar(
        select(Exercise).where(
            Exercise.id == custom_exercise_id,
        )
    )
    persisted_workout = db_session.scalar(
        select(Workout).where(
            Workout.id == workout_id,
        )
    )
    persisted_workout_exercise = db_session.scalar(
        select(WorkoutExercise).where(
            WorkoutExercise.id == workout_exercise_id,
        )
    )

    assert persisted_custom_exercise is None
    assert persisted_workout is None
    assert persisted_workout_exercise is None
