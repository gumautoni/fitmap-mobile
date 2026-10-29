from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import (
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


class ProgressStatisticsPayload(TypedDict):
    completed_workouts: int
    completed_workouts_last_7_days: int
    completed_workouts_last_30_days: int
    training_days_last_30_days: int
    total_performed_sets: int


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture(autouse=True)
def cleanup_progress_records(
    database_engine: Engine,
    created_emails: list[str],
) -> Iterator[None]:
    yield

    with database_engine.begin() as connection:
        if created_emails:
            connection.execute(
                delete(User).where(
                    User.email.in_(created_emails),
                )
            )


def register_user(
    *,
    client: TestClient,
    created_emails: list[str],
    name: str = "Progress User",
) -> AuthPayload:
    email = f"progress-statistics-{uuid4()}@example.com"
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


def create_completed_session(
    *,
    database_engine: Engine,
    user_id: UUID,
    workout_name: str,
    completed_at: datetime,
    performed_sets: int,
) -> None:
    with Session(database_engine) as db_session:
        workout_session = WorkoutSession(
            user_id=user_id,
            workout_name=workout_name,
            status="completed",
            started_at=completed_at - timedelta(hours=1),
            completed_at=completed_at,
        )

        db_session.add(workout_session)
        db_session.flush()

        exercise_execution = ExerciseExecution(
            workout_session_id=workout_session.id,
            exercise_name=f"{workout_name} Exercise",
            position=1,
            is_completed=True,
            completed_at=completed_at,
        )

        db_session.add(exercise_execution)
        db_session.flush()

        for position in range(1, performed_sets + 1):
            db_session.add(
                SetExecution(
                    exercise_execution_id=exercise_execution.id,
                    position=position,
                    repetitions=10,
                )
            )

        db_session.commit()


def test_progress_statistics_require_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/progress/statistics",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_progress_statistics_start_empty(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/progress/statistics",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == {
        "completed_workouts": 0,
        "completed_workouts_last_7_days": 0,
        "completed_workouts_last_30_days": 0,
        "training_days_last_30_days": 0,
        "total_performed_sets": 0,
    }


def test_progress_statistics_are_derived_from_completed_history(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    user_id = UUID(authentication["user"]["id"])
    now = datetime.now(UTC).replace(
        hour=12,
        minute=0,
        second=0,
        microsecond=0,
    )

    create_completed_session(
        database_engine=database_engine,
        user_id=user_id,
        workout_name="Recent A",
        completed_at=now - timedelta(days=1),
        performed_sets=2,
    )
    create_completed_session(
        database_engine=database_engine,
        user_id=user_id,
        workout_name="Recent B",
        completed_at=now - timedelta(days=1, hours=2),
        performed_sets=3,
    )
    create_completed_session(
        database_engine=database_engine,
        user_id=user_id,
        workout_name="Earlier This Month",
        completed_at=now - timedelta(days=10),
        performed_sets=4,
    )
    create_completed_session(
        database_engine=database_engine,
        user_id=user_id,
        workout_name="Older History",
        completed_at=now - timedelta(days=40),
        performed_sets=5,
    )

    response = client.get(
        "/api/v1/progress/statistics",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    statistics = cast(
        ProgressStatisticsPayload,
        response.json(),
    )

    assert statistics == {
        "completed_workouts": 4,
        "completed_workouts_last_7_days": 2,
        "completed_workouts_last_30_days": 3,
        "training_days_last_30_days": 2,
        "total_performed_sets": 14,
    }


def test_progress_statistics_are_isolated_between_users(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First Progress User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second Progress User",
    )

    completed_at = datetime.now(UTC) - timedelta(days=1)

    create_completed_session(
        database_engine=database_engine,
        user_id=UUID(first_user["user"]["id"]),
        workout_name="First User Workout",
        completed_at=completed_at,
        performed_sets=2,
    )
    create_completed_session(
        database_engine=database_engine,
        user_id=UUID(second_user["user"]["id"]),
        workout_name="Second User Workout",
        completed_at=completed_at,
        performed_sets=5,
    )

    response = client.get(
        "/api/v1/progress/statistics",
        headers=authorization_headers(first_user),
    )

    assert response.status_code == 200

    statistics = cast(
        ProgressStatisticsPayload,
        response.json(),
    )

    assert statistics["completed_workouts"] == 1
    assert statistics["total_performed_sets"] == 2
