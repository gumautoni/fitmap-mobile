from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import Exercise
from fitmap.training.planning import (
    ExerciseUnavailableError,
    InvalidWorkoutExerciseConfigurationError,
    InvalidWorkoutReorderError,
    WorkoutArchivedError,
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
    LoadUnit,
    WorkoutExerciseCreateRequest,
    WorkoutReorderRequest,
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
    name: str = "Training User",
) -> User:
    user = User(
        name=name,
        email=f"training-planning-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def create_catalog_exercise(
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


def test_custom_exercise_request_normalizes_name() -> None:
    request = CustomExerciseCreateRequest(
        name="  Incline   Cable   Press  ",
    )

    assert request.name == "Incline Cable Press"


def test_workout_exercise_create_request_requires_load_and_unit_together() -> None:
    exercise_id = uuid4()

    with pytest.raises(ValidationError):
        WorkoutExerciseCreateRequest(
            exercise_id=exercise_id,
            target_load=Decimal("20.00"),
        )

    with pytest.raises(ValidationError):
        WorkoutExerciseCreateRequest(
            exercise_id=exercise_id,
            target_load_unit=LoadUnit.KG,
        )


def test_workout_reorder_request_rejects_duplicate_ids() -> None:
    workout_exercise_id = uuid4()

    with pytest.raises(ValidationError):
        WorkoutReorderRequest(
            workout_exercise_ids=[
                workout_exercise_id,
                workout_exercise_id,
            ]
        )


def test_available_exercises_include_catalog_and_own_custom_only(
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

    catalog_exercise = create_catalog_exercise(
        db_session,
        name="Barbell Bench Press",
    )

    first_custom = create_custom_exercise(
        db_session=db_session,
        user_id=first_user.id,
        name="First Custom Exercise",
    )

    second_custom = create_custom_exercise(
        db_session=db_session,
        user_id=second_user.id,
        name="Second Custom Exercise",
    )

    exercises = list_available_exercises(
        db_session=db_session,
        user_id=first_user.id,
    )

    exercise_ids = {exercise.id for exercise in exercises}

    assert catalog_exercise.id in exercise_ids
    assert first_custom.id in exercise_ids
    assert second_custom.id not in exercise_ids


def test_archived_exercises_are_not_available(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    active_exercise = create_catalog_exercise(
        db_session,
        name="Active Exercise",
    )
    archived_exercise = create_catalog_exercise(
        db_session,
        name="Archived Exercise",
    )

    archived_exercise.is_archived = True
    db_session.flush()

    exercises = list_available_exercises(
        db_session=db_session,
        user_id=user.id,
    )

    exercise_ids = {exercise.id for exercise in exercises}

    assert active_exercise.id in exercise_ids
    assert archived_exercise.id not in exercise_ids


def test_custom_exercise_is_owned_by_authenticated_user(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_custom_exercise(
        db_session=db_session,
        user_id=user.id,
        name="My Exercise",
    )

    assert exercise.owner_user_id == user.id
    assert exercise.name == "My Exercise"
    assert exercise.is_archived is False


def test_workout_list_is_isolated_between_users(
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

    first_workout = create_workout(
        db_session=db_session,
        user_id=first_user.id,
        name="First Workout",
    )
    second_workout = create_workout(
        db_session=db_session,
        user_id=second_user.id,
        name="Second Workout",
    )

    workouts = list_workouts(
        db_session=db_session,
        user_id=first_user.id,
    )

    workout_ids = {workout.id for workout in workouts}

    assert first_workout.id in workout_ids
    assert second_workout.id not in workout_ids


def test_get_owned_workout_does_not_expose_another_users_workout(
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

    workout = create_workout(
        db_session=db_session,
        user_id=first_user.id,
        name="Private Workout",
    )

    result = get_owned_workout(
        db_session=db_session,
        user_id=second_user.id,
        workout_id=workout.id,
    )

    assert result is None


def test_workout_can_be_renamed_archived_and_restored(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Workout A",
    )

    renamed = rename_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        name="Push",
    )

    assert renamed.name == "Push"
    assert renamed.archived_at is None

    archived = archive_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    assert archived.archived_at is not None

    active_workouts = list_workouts(
        db_session=db_session,
        user_id=user.id,
    )

    assert workout.id not in {item.id for item in active_workouts}

    all_workouts = list_workouts(
        db_session=db_session,
        user_id=user.id,
        include_archived=True,
    )

    assert workout.id in {item.id for item in all_workouts}

    restored = restore_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    assert restored.archived_at is None


def test_another_user_cannot_modify_private_workout(
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

    workout = create_workout(
        db_session=db_session,
        user_id=owner.id,
        name="Private Workout",
    )

    with pytest.raises(WorkoutNotFoundError):
        rename_workout(
            db_session=db_session,
            user_id=other_user.id,
            workout_id=workout.id,
            name="Unauthorized Rename",
        )


def test_archived_workout_cannot_be_modified(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Archived Workout",
    )

    archive_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    with pytest.raises(WorkoutArchivedError):
        rename_workout(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            name="New Name",
        )


def test_user_can_add_catalog_and_own_custom_exercise_to_workout(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    catalog_exercise = create_catalog_exercise(
        db_session,
        name="Squat",
    )
    custom_exercise = create_custom_exercise(
        db_session=db_session,
        user_id=user.id,
        name="My Custom Exercise",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Legs",
    )

    first = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=catalog_exercise.id,
        target_sets=4,
        target_repetitions=8,
        target_load=Decimal("100.00"),
        target_load_unit="kg",
        notes=None,
    )

    second = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=custom_exercise.id,
        target_sets=3,
        target_repetitions=12,
        target_load=None,
        target_load_unit=None,
        notes="Controlled movement",
    )

    assert first.position == 1
    assert second.position == 2

    workout_exercises = list_workout_exercises(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    assert [item.id for item in workout_exercises] == [
        first.id,
        second.id,
    ]


def test_user_cannot_add_another_users_custom_exercise(
    db_session: Session,
) -> None:
    owner = create_user(
        db_session,
        name="Exercise Owner",
    )
    workout_owner = create_user(
        db_session,
        name="Workout Owner",
    )

    private_exercise = create_custom_exercise(
        db_session=db_session,
        user_id=owner.id,
        name="Private Exercise",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=workout_owner.id,
        name="Workout",
    )

    with pytest.raises(ExerciseUnavailableError):
        add_exercise_to_workout(
            db_session=db_session,
            user_id=workout_owner.id,
            workout_id=workout.id,
            exercise_id=private_exercise.id,
            target_sets=3,
            target_repetitions=10,
            target_load=None,
            target_load_unit=None,
            notes=None,
        )


def test_user_cannot_add_archived_exercise_to_workout(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Archived Exercise",
    )
    exercise.is_archived = True
    db_session.flush()

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Workout",
    )

    with pytest.raises(ExerciseUnavailableError):
        add_exercise_to_workout(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            exercise_id=exercise.id,
            target_sets=3,
            target_repetitions=10,
            target_load=None,
            target_load_unit=None,
            notes=None,
        )


def test_archived_workout_cannot_receive_new_exercise(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Lat Pulldown",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Pull",
    )

    archive_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    with pytest.raises(WorkoutArchivedError):
        add_exercise_to_workout(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            exercise_id=exercise.id,
            target_sets=3,
            target_repetitions=10,
            target_load=None,
            target_load_unit=None,
            notes=None,
        )


def test_add_exercise_rejects_incomplete_load_configuration(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Leg Press",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Legs",
    )

    with pytest.raises(InvalidWorkoutExerciseConfigurationError):
        add_exercise_to_workout(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            exercise_id=exercise.id,
            target_sets=3,
            target_repetitions=10,
            target_load=Decimal("100.00"),
            target_load_unit=None,
            notes=None,
        )


def test_workout_exercise_can_be_updated(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Bench Press",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Push",
    )

    workout_exercise = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=exercise.id,
        target_sets=3,
        target_repetitions=10,
        target_load=Decimal("50.00"),
        target_load_unit="kg",
        notes=None,
    )

    updates: WorkoutExerciseUpdateValues = {
        "target_sets": 4,
        "target_repetitions": 8,
        "target_load": Decimal("60.00"),
        "target_load_unit": "kg",
        "notes": "Progressive overload",
    }

    updated = update_workout_exercise(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        workout_exercise_id=workout_exercise.id,
        updates=updates,
    )

    assert updated.target_sets == 4
    assert updated.target_repetitions == 8
    assert updated.target_load == Decimal("60.00")
    assert updated.target_load_unit == "kg"
    assert updated.notes == "Progressive overload"


def test_partial_update_preserves_unmodified_workout_exercise_fields(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Bench Press",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Push",
    )

    workout_exercise = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=exercise.id,
        target_sets=3,
        target_repetitions=10,
        target_load=Decimal("50.00"),
        target_load_unit="kg",
        notes=None,
    )

    updates: WorkoutExerciseUpdateValues = {
        "notes": "Keep shoulders stable",
    }

    updated = update_workout_exercise(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        workout_exercise_id=workout_exercise.id,
        updates=updates,
    )

    assert updated.target_sets == 3
    assert updated.target_repetitions == 10
    assert updated.target_load == Decimal("50.00")
    assert updated.target_load_unit == "kg"
    assert updated.notes == "Keep shoulders stable"


def test_partial_update_cannot_leave_load_without_unit(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    exercise = create_catalog_exercise(
        db_session,
        name="Bench Press",
    )
    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Push",
    )

    workout_exercise = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=exercise.id,
        target_sets=3,
        target_repetitions=10,
        target_load=Decimal("50.00"),
        target_load_unit="kg",
        notes=None,
    )

    updates: WorkoutExerciseUpdateValues = {
        "target_load_unit": None,
    }

    with pytest.raises(InvalidWorkoutExerciseConfigurationError):
        update_workout_exercise(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            workout_exercise_id=workout_exercise.id,
            updates=updates,
        )


def test_removing_workout_exercise_compacts_positions(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_exercise = create_catalog_exercise(
        db_session,
        name="Exercise A",
    )
    second_exercise = create_catalog_exercise(
        db_session,
        name="Exercise B",
    )
    third_exercise = create_catalog_exercise(
        db_session,
        name="Exercise C",
    )

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Workout",
    )

    first = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=first_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )
    second = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=second_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )
    third = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=third_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )

    remove_workout_exercise(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        workout_exercise_id=second.id,
    )

    remaining = list_workout_exercises(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    assert [item.id for item in remaining] == [
        first.id,
        third.id,
    ]

    assert [item.position for item in remaining] == [
        1,
        2,
    ]


def test_workout_exercises_can_be_reordered(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_exercise = create_catalog_exercise(
        db_session,
        name="Exercise A",
    )
    second_exercise = create_catalog_exercise(
        db_session,
        name="Exercise B",
    )
    third_exercise = create_catalog_exercise(
        db_session,
        name="Exercise C",
    )

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Workout",
    )

    first = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=first_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )
    second = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=second_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )
    third = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=third_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )

    reordered = reorder_workout_exercises(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        ordered_ids=[
            third.id,
            first.id,
            second.id,
        ],
    )

    assert [item.id for item in reordered] == [
        third.id,
        first.id,
        second.id,
    ]

    assert [item.position for item in reordered] == [
        1,
        2,
        3,
    ]


def test_reorder_requires_every_workout_exercise_exactly_once(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_exercise = create_catalog_exercise(
        db_session,
        name="Exercise A",
    )
    second_exercise = create_catalog_exercise(
        db_session,
        name="Exercise B",
    )

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Workout",
    )

    first = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=first_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )
    second = add_exercise_to_workout(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
        exercise_id=second_exercise.id,
        target_sets=None,
        target_repetitions=None,
        target_load=None,
        target_load_unit=None,
        notes=None,
    )

    with pytest.raises(InvalidWorkoutReorderError):
        reorder_workout_exercises(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            ordered_ids=[
                first.id,
            ],
        )

    with pytest.raises(InvalidWorkoutReorderError):
        reorder_workout_exercises(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            ordered_ids=[
                first.id,
                second.id,
                uuid4(),
            ],
        )


def test_another_user_cannot_list_private_workout_exercises(
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

    workout = create_workout(
        db_session=db_session,
        user_id=owner.id,
        name="Private Workout",
    )

    with pytest.raises(WorkoutNotFoundError):
        list_workout_exercises(
            db_session=db_session,
            user_id=other_user.id,
            workout_id=workout.id,
        )
