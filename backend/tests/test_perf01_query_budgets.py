from collections.abc import Generator, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, event
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.orm import Session

from fitmap.gyms.favorites import list_favorite_gyms
from fitmap.gyms.models import FavoriteGym, Gym, GymExternalReference
from fitmap.identity.models import User
from fitmap.progress.performance import (
    ExerciseLoadMaximum,
    list_exercise_performance,
)
from fitmap.training.models import (
    Exercise,
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)

BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture
def db_connection(database_engine: Engine) -> Iterator[Connection]:
    with database_engine.connect() as connection:
        transaction = connection.begin()

        try:
            yield connection
        finally:
            if transaction.is_active:
                transaction.rollback()


@contextmanager
def capture_statements(
    connection: Connection,
) -> Generator[list[str]]:
    statements: list[str] = []

    def record_statement(
        _connection: Connection,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: ExecutionContext | None,
        _executemany: bool,
    ) -> None:
        statements.append(statement)

    event.listen(
        connection,
        "before_cursor_execute",
        record_statement,
    )

    try:
        yield statements
    finally:
        event.remove(
            connection,
            "before_cursor_execute",
            record_statement,
        )


def assert_query_budget(
    statements: list[str],
    maximum: int,
) -> None:
    assert all(statement.lstrip().upper().startswith("SELECT") for statement in statements)

    assert len(statements) <= maximum, (
        f"PERF01_QUERY_BUDGET: expected at most {maximum} SQL queries, observed {len(statements)}"
    )


def create_user(session: Session) -> UUID:
    user = User(
        name="PERF01 Synthetic User",
        email=f"perf01-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    session.add(user)
    session.flush()

    return user.id


def create_favorite(
    session: Session,
    *,
    user_id: UUID,
    created_at: datetime = BASE_TIME,
    with_reference: bool = True,
) -> tuple[UUID, UUID]:
    gym = Gym(
        name=f"PERF01 Gym {uuid4()}",
        address="Synthetic test address",
        latitude=-22.47,
        longitude=-43.82,
    )

    session.add(gym)
    session.flush()

    favorite = FavoriteGym(
        user_id=user_id,
        gym_id=gym.id,
        created_at=created_at,
    )

    session.add(favorite)

    if with_reference:
        session.add(
            GymExternalReference(
                gym_id=gym.id,
                provider_name="geoapify",
                external_id=f"perf01-{uuid4()}",
                created_at=created_at,
            )
        )

    session.flush()

    return favorite.id, gym.id


def create_exercise(session: Session) -> UUID:
    exercise = Exercise(
        name=f"PERF01 Exercise {uuid4()}",
    )

    session.add(exercise)
    session.flush()

    return exercise.id


def create_workout_session(
    session: Session,
    *,
    user_id: UUID,
    timestamp: datetime,
    status: str = "completed",
) -> UUID:
    workout = WorkoutSession(
        user_id=user_id,
        workout_name="PERF01 Synthetic Workout",
        status=status,
        started_at=timestamp - timedelta(hours=1),
        completed_at=timestamp if status == "completed" else None,
        cancelled_at=timestamp if status == "cancelled" else None,
    )

    session.add(workout)
    session.flush()

    return workout.id


PerformedSet = tuple[int, Decimal | None, str | None]


def create_execution(
    session: Session,
    *,
    workout_session_id: UUID,
    exercise_id: UUID | None,
    timestamp: datetime,
    position: int = 1,
    performed_sets: tuple[PerformedSet, ...] = ((10, Decimal("60.00"), "kg"),),
    completed: bool = True,
) -> UUID:
    execution = ExerciseExecution(
        workout_session_id=workout_session_id,
        exercise_id=exercise_id,
        exercise_name="PERF01 Exercise",
        position=position,
        is_completed=completed,
        completed_at=timestamp if completed else None,
    )

    session.add(execution)
    session.flush()

    for set_position, values in enumerate(
        performed_sets,
        start=1,
    ):
        repetitions, load, load_unit = values

        session.add(
            SetExecution(
                exercise_execution_id=execution.id,
                position=set_position,
                repetitions=repetitions,
                load=load,
                load_unit=load_unit,
            )
        )

    session.flush()

    return execution.id


@pytest.mark.parametrize("size", [0, 1, 10, 50, 100])
def test_favorite_query_budget(
    db_connection: Connection,
    size: int,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)

        for index in range(size):
            create_favorite(
                session,
                user_id=user_id,
                created_at=BASE_TIME + timedelta(minutes=index),
            )

    with (
        Session(
            bind=db_connection,
            join_transaction_mode="rollback_only",
        ) as session,
        capture_statements(db_connection) as statements,
    ):
        result = list_favorite_gyms(
            db_session=session,
            user_id=user_id,
        )

    assert len(result) == size

    assert_query_budget(
        statements,
        maximum=1 if size == 0 else 3,
    )


@pytest.mark.parametrize("size", [0, 1, 10, 50, 100])
def test_performance_query_budget(
    db_connection: Connection,
    size: int,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)
        exercise_id = create_exercise(session)

        for index in range(size):
            timestamp = BASE_TIME + timedelta(days=index)

            workout_id = create_workout_session(
                session,
                user_id=user_id,
                timestamp=timestamp,
            )

            create_execution(
                session,
                workout_session_id=workout_id,
                exercise_id=exercise_id,
                timestamp=timestamp,
            )

    with (
        Session(
            bind=db_connection,
            join_transaction_mode="rollback_only",
        ) as session,
        capture_statements(db_connection) as statements,
    ):
        result = list_exercise_performance(
            db_session=session,
            user_id=user_id,
        )

    assert len(result) == (1 if size >= 2 else 0)

    if size >= 2:
        assert len(result[0].points) == size
        assert sum(point.total_repetitions for point in result[0].points) == size * 10

    assert_query_budget(
        statements,
        maximum=1 if size == 0 else 2,
    )


def test_favorite_list_preserves_order_and_owner(
    db_connection: Connection,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        owner_id = create_user(session)
        other_id = create_user(session)

        older_id, _ = create_favorite(
            session,
            user_id=owner_id,
            created_at=BASE_TIME,
        )

        timestamp = BASE_TIME + timedelta(days=1)

        first_id, _ = create_favorite(
            session,
            user_id=owner_id,
            created_at=timestamp,
        )

        second_id, _ = create_favorite(
            session,
            user_id=owner_id,
            created_at=timestamp,
        )

        create_favorite(
            session,
            user_id=other_id,
            created_at=timestamp + timedelta(days=1),
        )

    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        result = list_favorite_gyms(
            db_session=session,
            user_id=owner_id,
        )

    expected = [
        *sorted((first_id, second_id), reverse=True),
        older_id,
    ]

    assert [favorite.favorite_id for favorite in result] == expected


def test_favorite_reference_selection_preserves_oldest_and_tie_break(
    db_connection: Connection,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)

        favorite_id, gym_id = create_favorite(
            session,
            user_id=user_id,
            with_reference=False,
        )

        first_id, second_id = sorted((uuid4(), uuid4()))

        session.add_all(
            [
                GymExternalReference(
                    id=second_id,
                    gym_id=gym_id,
                    provider_name="tomtom",
                    external_id=f"second-{uuid4()}",
                    created_at=BASE_TIME,
                ),
                GymExternalReference(
                    id=first_id,
                    gym_id=gym_id,
                    provider_name="geoapify",
                    external_id=f"first-{uuid4()}",
                    created_at=BASE_TIME,
                ),
                GymExternalReference(
                    gym_id=gym_id,
                    provider_name="synthetic-other",
                    external_id=f"newer-{uuid4()}",
                    created_at=BASE_TIME + timedelta(days=1),
                ),
            ]
        )

        session.flush()

        expected_reference = session.get(
            GymExternalReference,
            first_id,
        )

        assert expected_reference is not None

        expected_external_id = expected_reference.external_id

    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        result = list_favorite_gyms(
            db_session=session,
            user_id=user_id,
        )

    assert len(result) == 1
    assert result[0].favorite_id == favorite_id
    assert result[0].gym_id == gym_id
    assert result[0].provider_name == "geoapify"
    assert result[0].external_id == expected_external_id


def test_favorite_missing_reference_still_raises(
    db_connection: Connection,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)

        create_favorite(
            session,
            user_id=user_id,
            with_reference=False,
        )

    with (
        Session(
            bind=db_connection,
            join_transaction_mode="rollback_only",
        ) as session,
        pytest.raises(
            RuntimeError,
            match="Favorite gym does not have an external reference",
        ),
    ):
        list_favorite_gyms(
            db_session=session,
            user_id=user_id,
        )


def test_performance_aggregates_repeated_executions_and_load_units(
    db_connection: Connection,
) -> None:
    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)
        exercise_id = create_exercise(session)

        first_id = create_workout_session(
            session,
            user_id=user_id,
            timestamp=BASE_TIME,
        )

        create_execution(
            session,
            workout_session_id=first_id,
            exercise_id=exercise_id,
            timestamp=BASE_TIME,
            performed_sets=(
                (8, Decimal("60.00"), "kg"),
                (10, Decimal("65.00"), "kg"),
            ),
        )

        create_execution(
            session,
            workout_session_id=first_id,
            exercise_id=exercise_id,
            timestamp=BASE_TIME,
            position=2,
            performed_sets=(
                (6, Decimal("100.00"), "lb"),
                (4, None, None),
            ),
        )

        second_time = BASE_TIME + timedelta(days=1)

        second_id = create_workout_session(
            session,
            user_id=user_id,
            timestamp=second_time,
        )

        create_execution(
            session,
            workout_session_id=second_id,
            exercise_id=exercise_id,
            timestamp=second_time,
            performed_sets=((9, Decimal("70.00"), "kg"),),
        )

        empty_time = BASE_TIME + timedelta(days=2)

        empty_id = create_workout_session(
            session,
            user_id=user_id,
            timestamp=empty_time,
        )

        create_execution(
            session,
            workout_session_id=empty_id,
            exercise_id=exercise_id,
            timestamp=empty_time,
            performed_sets=(),
        )

    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        result = list_exercise_performance(
            db_session=session,
            user_id=user_id,
        )

    assert len(result) == 1
    assert result[0].exercise_id == exercise_id

    points = result[0].points

    assert len(points) == 2

    assert [point.workout_session_id for point in points] == [first_id, second_id]

    assert points[0].completed_at == BASE_TIME
    assert points[0].performed_sets == 4
    assert points[0].total_repetitions == 28

    assert points[0].max_loads == (
        ExerciseLoadMaximum(
            load_unit="kg",
            max_load=Decimal("65.00"),
        ),
        ExerciseLoadMaximum(
            load_unit="lb",
            max_load=Decimal("100.00"),
        ),
    )

    assert points[1].completed_at == second_time
    assert points[1].performed_sets == 1
    assert points[1].total_repetitions == 9

    assert points[1].max_loads == (
        ExerciseLoadMaximum(
            load_unit="kg",
            max_load=Decimal("70.00"),
        ),
    )


def test_performance_excludes_ineligible_sessions(
    db_connection: Connection,
) -> None:
    expected_ids: list[UUID] = []

    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        user_id = create_user(session)
        other_id = create_user(session)
        exercise_id = create_exercise(session)

        for index in range(2):
            timestamp = BASE_TIME + timedelta(days=index)

            workout_id = create_workout_session(
                session,
                user_id=user_id,
                timestamp=timestamp,
            )

            expected_ids.append(workout_id)

            create_execution(
                session,
                workout_session_id=workout_id,
                exercise_id=exercise_id,
                timestamp=timestamp,
            )

        for index, status in enumerate(
            ("active", "cancelled"),
            start=2,
        ):
            timestamp = BASE_TIME + timedelta(days=index)

            workout_id = create_workout_session(
                session,
                user_id=user_id,
                timestamp=timestamp,
                status=status,
            )

            create_execution(
                session,
                workout_session_id=workout_id,
                exercise_id=exercise_id,
                timestamp=timestamp,
                completed=False,
            )

        other_time = BASE_TIME + timedelta(days=5)

        other_workout_id = create_workout_session(
            session,
            user_id=other_id,
            timestamp=other_time,
        )

        create_execution(
            session,
            workout_session_id=other_workout_id,
            exercise_id=exercise_id,
            timestamp=other_time,
        )

        unlinked_time = BASE_TIME + timedelta(days=6)

        unlinked_id = create_workout_session(
            session,
            user_id=user_id,
            timestamp=unlinked_time,
        )

        create_execution(
            session,
            workout_session_id=unlinked_id,
            exercise_id=None,
            timestamp=unlinked_time,
        )

    with Session(
        bind=db_connection,
        join_transaction_mode="rollback_only",
    ) as session:
        result = list_exercise_performance(
            db_session=session,
            user_id=user_id,
        )

    assert len(result) == 1

    assert [point.workout_session_id for point in result[0].points] == expected_ids

    assert all(point.total_repetitions == 10 for point in result[0].points)
