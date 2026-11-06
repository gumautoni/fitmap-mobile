"""Regression tests for the Brazilian Portuguese exercise catalog."""

from collections.abc import Iterator
from unicodedata import category, normalize
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import Exercise, WorkoutExercise
from fitmap.training.planning import (
    add_exercise_to_workout,
    create_custom_exercise,
    create_workout,
    list_available_exercises,
)
from fitmap.training.sessions import (
    list_session_exercise_executions,
    start_workout_session,
)

ORIGINAL_TRANSLATIONS = (
    "Supino reto com barra",
    "Supino inclinado com halteres",
    "Flexão de braços",
    "Puxada frontal na polia alta",
    "Remada sentada na polia baixa",
    "Remada curvada com barra",
    "Agachamento livre com barra",
    "Leg press",
    "Levantamento terra romeno",
    "Cadeira extensora",
    "Flexora de pernas na máquina",
    "Elevação de panturrilhas em pé",
    "Desenvolvimento de ombros",
    "Elevação lateral com halteres",
    "Rosca direta com barra",
    "Rosca bíceps com halteres",
    "Tríceps na polia alta",
    "Extensão de tríceps acima da cabeça",
    "Prancha isométrica",
    "Abdominal curto",
)


def catalog_id(number: int) -> UUID:
    return UUID(f"00000000-0000-4000-8000-{number:012d}")


def normalized_name(value: str) -> str:
    decomposed = normalize("NFD", value.casefold())

    without_accents = "".join(character for character in decomposed if category(character) != "Mn")

    return " ".join(without_accents.split())


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


def create_test_user(session: Session) -> User:
    user = User(
        name="Exercise Catalog Test User",
        email=f"catalog-ptbr-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    session.add(user)
    session.flush()

    return user


def test_catalog_contains_100_stable_global_exercises(
    db_session: Session,
) -> None:
    exercises = list(
        db_session.scalars(
            select(Exercise).where(
                Exercise.owner_user_id.is_(None),
            )
        ).all()
    )

    assert len(exercises) == 100

    expected_ids = {catalog_id(number) for number in range(1, 101)}

    assert {exercise.id for exercise in exercises} == expected_ids

    assert all(not exercise.is_archived for exercise in exercises)

    names = [normalized_name(exercise.name) for exercise in exercises]

    assert len(names) == len(set(names))
    assert all(0 < len(exercise.name) <= 120 for exercise in exercises)


def test_original_20_ids_keep_their_portuguese_names(
    db_session: Session,
) -> None:
    for number, expected_name in enumerate(
        ORIGINAL_TRANSLATIONS,
        start=1,
    ):
        exercise = db_session.get(
            Exercise,
            catalog_id(number),
        )

        assert exercise is not None
        assert exercise.name == expected_name
        assert exercise.owner_user_id is None
        assert exercise.is_archived is False


def test_added_exercises_include_common_gym_variations(
    db_session: Session,
) -> None:
    expected = {
        21: "Supino reto com halteres",
        22: "Supino inclinado com barra",
        32: "Barra fixa com pegada pronada",
        45: "Agachamento frontal com barra",
        55: "Levantamento terra convencional",
        67: "Desenvolvimento com halteres",
        76: "Rosca alternada com halteres",
        83: "Tríceps testa com barra W",
        90: "Elevação de panturrilhas sentado",
        93: "Prancha lateral",
        100: "Bird dog",
    }

    for number, expected_name in expected.items():
        exercise = db_session.get(
            Exercise,
            catalog_id(number),
        )

        assert exercise is not None
        assert exercise.name == expected_name
        assert exercise.owner_user_id is None


def test_custom_exercises_remain_private_and_catalog_is_shared(
    db_session: Session,
) -> None:
    first_user = create_test_user(db_session)
    second_user = create_test_user(db_session)

    first_custom = create_custom_exercise(
        db_session=db_session,
        user_id=first_user.id,
        name="Exercício exclusivo do primeiro usuário",
    )

    second_custom = create_custom_exercise(
        db_session=db_session,
        user_id=second_user.id,
        name="Exercício exclusivo do segundo usuário",
    )

    first_available = list_available_exercises(
        db_session=db_session,
        user_id=first_user.id,
    )

    second_available = list_available_exercises(
        db_session=db_session,
        user_id=second_user.id,
    )

    first_ids = {exercise.id for exercise in first_available}
    second_ids = {exercise.id for exercise in second_available}

    assert len(first_ids) == 101
    assert len(second_ids) == 101

    assert catalog_id(1) in first_ids
    assert catalog_id(100) in first_ids
    assert catalog_id(1) in second_ids
    assert catalog_id(100) in second_ids

    assert first_custom.id in first_ids
    assert first_custom.id not in second_ids

    assert second_custom.id in second_ids
    assert second_custom.id not in first_ids


def test_planned_links_and_historical_snapshots_survive_name_changes(
    db_session: Session,
) -> None:
    user = create_test_user(db_session)

    workout = create_workout(
        db_session=db_session,
        user_id=user.id,
        name="Teste de integridade do catálogo",
    )

    original_id = catalog_id(1)
    added_id = catalog_id(21)

    for exercise_id in (original_id, added_id):
        add_exercise_to_workout(
            db_session=db_session,
            user_id=user.id,
            workout_id=workout.id,
            exercise_id=exercise_id,
            target_sets=3,
            target_repetitions=10,
            target_load=None,
            target_load_unit=None,
            notes=None,
        )

    started = start_workout_session(
        db_session=db_session,
        user_id=user.id,
        workout_id=workout.id,
    )

    before = list_session_exercise_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=started.id,
    )

    assert len(before) == 2
    assert before[0].exercise_id == original_id
    assert before[0].exercise_name == "Supino reto com barra"
    assert before[1].exercise_id == added_id
    assert before[1].exercise_name == "Supino reto com halteres"

    # Simulate an exercise name update. The test transaction
    # will be rolled back, leaving no persistent modifications.
    db_session.execute(
        update(Exercise).where(Exercise.id == original_id).values(name="Nome temporário para teste")
    )

    db_session.expire_all()

    after = list_session_exercise_executions(
        db_session=db_session,
        user_id=user.id,
        workout_session_id=started.id,
    )

    assert len(after) == 2
    assert after[0].exercise_id == original_id
    assert after[0].exercise_name == "Supino reto com barra"
    assert after[1].exercise_id == added_id
    assert after[1].exercise_name == "Supino reto com halteres"

    planned_ids = set(
        db_session.scalars(
            select(WorkoutExercise.exercise_id).where(WorkoutExercise.workout_id == workout.id)
        ).all()
    )

    assert planned_ids == {original_id, added_id}
