from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import (
    Exercise,
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)


class TokenPayload(TypedDict):
    access_token: str
    access_token_expires_at: str
    refresh_token: str
    refresh_token_expires_at: str
    token_type: str


class UserPayload(TypedDict):
    id: str
    name: str
    email: str
    created_at: str


class AuthPayload(TypedDict):
    user: UserPayload
    tokens: TokenPayload


class LoadMaximumPayload(TypedDict):
    load_unit: str
    max_load: str


class PerformancePointPayload(TypedDict):
    workout_session_id: str
    completed_at: str
    performed_sets: int
    total_repetitions: int
    max_loads: list[LoadMaximumPayload]


class PerformanceSeriesPayload(TypedDict):
    exercise_id: str
    exercise_name: str
    points: list[PerformancePointPayload]


PerformedSetInput = tuple[
    int,
    Decimal | None,
    str | None,
]


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture
def catalog_exercise_ids() -> Iterator[list[UUID]]:
    exercise_ids: list[UUID] = []
    yield exercise_ids


@pytest.fixture(autouse=True)
def cleanup_progress_records(
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> Iterator[None]:
    yield

    with database_engine.begin() as connection:
        if created_emails:
            connection.execute(
                delete(User).where(
                    User.email.in_(created_emails),
                )
            )

        if catalog_exercise_ids:
            connection.execute(
                delete(Exercise).where(
                    Exercise.id.in_(catalog_exercise_ids),
                )
            )


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
    name: str = "Performance User",
) -> AuthPayload:
    email = f"progress-performance-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "FitMap@123456",
        },
    )

    assert response.status_code == 201

    return cast(
        AuthPayload,
        response.json(),
    )


def authorization_headers(
    authentication: AuthPayload,
) -> dict[str, str]:
    return {
        "Authorization": (f"Bearer {authentication['tokens']['access_token']}"),
    }


def create_catalog_exercise(
    *,
    database_engine: Engine,
    catalog_exercise_ids: list[UUID],
    name: str,
) -> Exercise:
    with Session(
        database_engine,
        expire_on_commit=False,
    ) as db_session:
        exercise = Exercise(
            name=name,
        )

        db_session.add(exercise)
        db_session.commit()
        db_session.refresh(exercise)

        catalog_exercise_ids.append(exercise.id)

        return exercise


def create_exercise_session(
    *,
    database_engine: Engine,
    user_id: UUID,
    exercise_id: UUID,
    exercise_name: str,
    status: str,
    started_at: datetime,
    completed_at: datetime | None,
    cancelled_at: datetime | None,
    performed_sets: list[PerformedSetInput],
) -> UUID:
    with Session(database_engine) as db_session:
        workout_session = WorkoutSession(
            user_id=user_id,
            workout_name=f"{exercise_name} Workout",
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            cancelled_at=cancelled_at,
        )

        db_session.add(workout_session)
        db_session.flush()

        exercise_execution = ExerciseExecution(
            workout_session_id=workout_session.id,
            exercise_id=exercise_id,
            exercise_name=exercise_name,
            position=1,
            is_completed=status == "completed",
            completed_at=completed_at if status == "completed" else None,
        )

        db_session.add(exercise_execution)
        db_session.flush()

        for position, performed_set in enumerate(
            performed_sets,
            start=1,
        ):
            repetitions, load, load_unit = performed_set

            db_session.add(
                SetExecution(
                    exercise_execution_id=exercise_execution.id,
                    position=position,
                    repetitions=repetitions,
                    load=load,
                    load_unit=load_unit,
                )
            )

        db_session.commit()

        return workout_session.id


def test_exercise_performance_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/progress/exercises/performance",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_exercise_performance_requires_at_least_two_completed_sessions(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Bench Press",
    )

    completed_at = datetime.now(UTC) - timedelta(days=1)

    create_exercise_session(
        database_engine=database_engine,
        user_id=UUID(authentication["user"]["id"]),
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        status="completed",
        started_at=completed_at - timedelta(hours=1),
        completed_at=completed_at,
        cancelled_at=None,
        performed_sets=[
            (
                10,
                Decimal("60.00"),
                "kg",
            ),
        ],
    )

    response = client.get(
        "/api/v1/progress/exercises/performance",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_exercise_performance_returns_chronological_recorded_history(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Back Squat",
    )

    user_id = UUID(authentication["user"]["id"])
    now = datetime.now(UTC).replace(
        microsecond=0,
    )

    older_session_id = create_exercise_session(
        database_engine=database_engine,
        user_id=user_id,
        exercise_id=exercise.id,
        exercise_name="Back Squat",
        status="completed",
        started_at=now - timedelta(days=8, hours=1),
        completed_at=now - timedelta(days=8),
        cancelled_at=None,
        performed_sets=[
            (
                8,
                Decimal("80.00"),
                "kg",
            ),
            (
                6,
                Decimal("85.00"),
                "kg",
            ),
        ],
    )

    newer_session_id = create_exercise_session(
        database_engine=database_engine,
        user_id=user_id,
        exercise_id=exercise.id,
        exercise_name="Back Squat",
        status="completed",
        started_at=now - timedelta(days=1, hours=1),
        completed_at=now - timedelta(days=1),
        cancelled_at=None,
        performed_sets=[
            (
                10,
                Decimal("90.00"),
                "kg",
            ),
            (
                5,
                Decimal("200.00"),
                "lb",
            ),
        ],
    )

    response = client.get(
        "/api/v1/progress/exercises/performance",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    payload = cast(
        list[PerformanceSeriesPayload],
        response.json(),
    )

    assert len(payload) == 1

    performance = payload[0]

    assert performance["exercise_id"] == str(exercise.id)
    assert performance["exercise_name"] == "Back Squat"
    assert len(performance["points"]) == 2

    older_point = performance["points"][0]
    newer_point = performance["points"][1]

    assert older_point["workout_session_id"] == str(older_session_id)
    assert older_point["performed_sets"] == 2
    assert older_point["total_repetitions"] == 14
    assert older_point["max_loads"] == [
        {
            "load_unit": "kg",
            "max_load": "85.00",
        }
    ]

    assert newer_point["workout_session_id"] == str(newer_session_id)
    assert newer_point["performed_sets"] == 2
    assert newer_point["total_repetitions"] == 15
    assert newer_point["max_loads"] == [
        {
            "load_unit": "kg",
            "max_load": "90.00",
        },
        {
            "load_unit": "lb",
            "max_load": "200.00",
        },
    ]

    assert older_point["completed_at"] < newer_point["completed_at"]


def test_active_and_cancelled_sessions_do_not_create_performance_history(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Deadlift",
    )

    user_id = UUID(authentication["user"]["id"])
    now = datetime.now(UTC)

    create_exercise_session(
        database_engine=database_engine,
        user_id=user_id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        status="completed",
        started_at=now - timedelta(days=3, hours=1),
        completed_at=now - timedelta(days=3),
        cancelled_at=None,
        performed_sets=[
            (
                5,
                Decimal("100.00"),
                "kg",
            ),
        ],
    )

    create_exercise_session(
        database_engine=database_engine,
        user_id=user_id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        status="cancelled",
        started_at=now - timedelta(days=2, hours=1),
        completed_at=None,
        cancelled_at=now - timedelta(days=2),
        performed_sets=[
            (
                5,
                Decimal("105.00"),
                "kg",
            ),
        ],
    )

    create_exercise_session(
        database_engine=database_engine,
        user_id=user_id,
        exercise_id=exercise.id,
        exercise_name=exercise.name,
        status="active",
        started_at=now - timedelta(hours=1),
        completed_at=None,
        cancelled_at=None,
        performed_sets=[
            (
                5,
                Decimal("110.00"),
                "kg",
            ),
        ],
    )

    response = client.get(
        "/api/v1/progress/exercises/performance",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_exercise_performance_is_isolated_between_users(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First Performance User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second Performance User",
    )

    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Shoulder Press",
    )

    now = datetime.now(UTC)

    for user, load in (
        (
            first_user,
            Decimal("40.00"),
        ),
        (
            second_user,
            Decimal("70.00"),
        ),
    ):
        user_id = UUID(user["user"]["id"])

        create_exercise_session(
            database_engine=database_engine,
            user_id=user_id,
            exercise_id=exercise.id,
            exercise_name=exercise.name,
            status="completed",
            started_at=now - timedelta(days=2, hours=1),
            completed_at=now - timedelta(days=2),
            cancelled_at=None,
            performed_sets=[
                (
                    10,
                    load,
                    "kg",
                ),
            ],
        )
        create_exercise_session(
            database_engine=database_engine,
            user_id=user_id,
            exercise_id=exercise.id,
            exercise_name=exercise.name,
            status="completed",
            started_at=now - timedelta(days=1, hours=1),
            completed_at=now - timedelta(days=1),
            cancelled_at=None,
            performed_sets=[
                (
                    8,
                    load + Decimal("5.00"),
                    "kg",
                ),
            ],
        )

    response = client.get(
        "/api/v1/progress/exercises/performance",
        headers=authorization_headers(first_user),
    )

    assert response.status_code == 200

    payload = cast(
        list[PerformanceSeriesPayload],
        response.json(),
    )

    assert len(payload) == 1

    points = payload[0]["points"]

    assert len(points) == 2
    assert points[0]["max_loads"] == [
        {
            "load_unit": "kg",
            "max_load": "40.00",
        }
    ]
    assert points[1]["max_loads"] == [
        {
            "load_unit": "kg",
            "max_load": "45.00",
        }
    ]
