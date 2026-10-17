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
    Exercise,
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


class WorkoutExercisePayload(TypedDict):
    id: str
    exercise_id: str
    exercise_name: str
    position: int
    target_sets: int | None
    target_repetitions: int | None
    target_load: str | None
    target_load_unit: str | None
    notes: str | None
    created_at: str
    updated_at: str


class WorkoutPayload(TypedDict):
    id: str
    name: str
    is_archived: bool
    archived_at: str | None
    created_at: str
    updated_at: str
    exercises: list[WorkoutExercisePayload]


class SetExecutionPayload(TypedDict):
    id: str
    position: int
    repetitions: int
    load: str | None
    load_unit: str | None
    created_at: str
    updated_at: str


class ExerciseExecutionPayload(TypedDict):
    id: str
    exercise_id: str | None
    exercise_name: str
    position: int
    planned_sets: int | None
    planned_repetitions: int | None
    planned_load: str | None
    planned_load_unit: str | None
    planned_notes: str | None
    notes: str | None
    is_completed: bool
    completed_at: str | None
    sets: list[SetExecutionPayload]
    created_at: str
    updated_at: str


class WorkoutSessionPayload(TypedDict):
    id: str
    source_workout_id: str | None
    workout_name: str
    status: str
    notes: str | None
    started_at: str
    completed_at: str | None
    cancelled_at: str | None
    exercises: list[ExerciseExecutionPayload]
    created_at: str
    updated_at: str


class WorkoutHistoryPayload(TypedDict):
    id: str
    source_workout_id: str | None
    workout_name: str
    notes: str | None
    started_at: str
    completed_at: str
    created_at: str
    updated_at: str


@pytest.fixture
def created_emails() -> Iterator[list[str]]:
    emails: list[str] = []
    yield emails


@pytest.fixture
def catalog_exercise_ids() -> Iterator[list[UUID]]:
    exercise_ids: list[UUID] = []
    yield exercise_ids


@pytest.fixture(autouse=True)
def cleanup_training_records(
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
    name: str = "History User",
) -> AuthPayload:
    email = f"training-history-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "123456789012345",
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
    ) as session:
        exercise = Exercise(
            name=name,
        )

        session.add(exercise)
        session.commit()
        session.refresh(exercise)

        catalog_exercise_ids.append(exercise.id)

        return exercise


def create_configured_workout(
    *,
    client: TestClient,
    database_engine: Engine,
    authentication: AuthPayload,
    catalog_exercise_ids: list[UUID],
    workout_name: str,
    exercise_name: str,
) -> WorkoutPayload:
    workout_response = client.post(
        "/api/v1/training/workouts",
        headers=authorization_headers(authentication),
        json={
            "name": workout_name,
        },
    )

    assert workout_response.status_code == 201

    workout = cast(
        WorkoutPayload,
        workout_response.json(),
    )

    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name=exercise_name,
    )

    add_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": str(exercise.id),
            "target_sets": 4,
            "target_repetitions": 10,
            "target_load": "60.00",
            "target_load_unit": "kg",
            "notes": "Original planned notes.",
        },
    )

    assert add_response.status_code == 201

    return cast(
        WorkoutPayload,
        add_response.json(),
    )


def start_session(
    *,
    client: TestClient,
    authentication: AuthPayload,
    workout_id: str,
) -> WorkoutSessionPayload:
    response = client.post(
        f"/api/v1/training/workouts/{workout_id}/sessions",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 201

    return cast(
        WorkoutSessionPayload,
        response.json(),
    )


def finish_session(
    *,
    client: TestClient,
    authentication: AuthPayload,
    workout_session_id: str,
) -> WorkoutSessionPayload:
    response = client.post(
        (f"/api/v1/training/sessions/{workout_session_id}/finish"),
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    return cast(
        WorkoutSessionPayload,
        response.json(),
    )


def test_history_requires_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/training/history",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_history_starts_empty(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []


def test_completed_session_appears_in_history(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Push Day",
        exercise_name="History Bench Press",
    )

    workout_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    completed = finish_session(
        client=client,
        authentication=authentication,
        workout_session_id=workout_session["id"],
    )

    response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    history = cast(
        list[WorkoutHistoryPayload],
        response.json(),
    )

    assert len(history) == 1

    item = history[0]

    assert item["id"] == completed["id"]
    assert item["source_workout_id"] == workout["id"]
    assert item["workout_name"] == "Push Day"
    assert item["started_at"] == completed["started_at"]
    assert item["completed_at"] == completed["completed_at"]


def test_active_and_cancelled_sessions_are_excluded_from_history(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    cancelled_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Cancelled Workout",
        exercise_name="Cancelled Exercise",
    )

    cancelled_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=cancelled_workout["id"],
    )

    cancel_response = client.post(
        (f"/api/v1/training/sessions/{cancelled_session['id']}/cancel"),
        headers=authorization_headers(authentication),
    )

    assert cancel_response.status_code == 200

    active_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Active Workout",
        exercise_name="Active Exercise",
    )

    active_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=active_workout["id"],
    )

    response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() == []

    active_response = client.get(
        "/api/v1/training/sessions/active",
        headers=authorization_headers(authentication),
    )

    assert active_response.status_code == 200
    assert active_response.json()["id"] == active_session["id"]


def test_history_is_isolated_between_users(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    first_user = register_user(
        client=client,
        created_emails=created_emails,
        name="First User",
    )
    second_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Second User",
    )

    first_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=first_user,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="First Workout",
        exercise_name="First Exercise",
    )
    second_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=second_user,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Second Workout",
        exercise_name="Second Exercise",
    )

    first_session = start_session(
        client=client,
        authentication=first_user,
        workout_id=first_workout["id"],
    )
    second_session = start_session(
        client=client,
        authentication=second_user,
        workout_id=second_workout["id"],
    )

    finish_session(
        client=client,
        authentication=first_user,
        workout_session_id=first_session["id"],
    )
    finish_session(
        client=client,
        authentication=second_user,
        workout_session_id=second_session["id"],
    )

    response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(first_user),
    )

    assert response.status_code == 200

    history = cast(
        list[WorkoutHistoryPayload],
        response.json(),
    )

    assert len(history) == 1
    assert history[0]["id"] == first_session["id"]
    assert history[0]["workout_name"] == "First Workout"


def test_history_is_ordered_by_most_recent_completion(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    first_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Older Workout",
        exercise_name="Older Exercise",
    )

    first_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=first_workout["id"],
    )

    finish_session(
        client=client,
        authentication=authentication,
        workout_session_id=first_session["id"],
    )

    second_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Newer Workout",
        exercise_name="Newer Exercise",
    )

    second_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=second_workout["id"],
    )

    finish_session(
        client=client,
        authentication=authentication,
        workout_session_id=second_session["id"],
    )

    older_time = datetime.now(UTC) - timedelta(days=2)
    newer_time = datetime.now(UTC) - timedelta(days=1)

    with Session(database_engine) as db_session:
        first_record = db_session.get(
            WorkoutSession,
            UUID(first_session["id"]),
        )
        second_record = db_session.get(
            WorkoutSession,
            UUID(second_session["id"]),
        )

        assert first_record is not None
        assert second_record is not None

        first_record.completed_at = older_time
        second_record.completed_at = newer_time

        db_session.commit()

    response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    history = cast(
        list[WorkoutHistoryPayload],
        response.json(),
    )

    assert [item["id"] for item in history] == [
        second_session["id"],
        first_session["id"],
    ]


def test_history_preserves_snapshot_after_source_workout_changes(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Original Push",
        exercise_name="Original Bench Press",
    )

    workout_session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )
    execution = workout_session["exercises"][0]

    set_response = client.post(
        (f"/api/v1/training/sessions/{workout_session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 9,
            "load": "62.50",
            "load_unit": "kg",
        },
    )

    assert set_response.status_code == 201

    finish_session(
        client=client,
        authentication=authentication,
        workout_session_id=workout_session["id"],
    )

    rename_response = client.patch(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(authentication),
        json={
            "name": "Renamed Push",
        },
    )

    assert rename_response.status_code == 200

    archive_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/archive",
        headers=authorization_headers(authentication),
    )

    assert archive_response.status_code == 200

    exercise_id = UUID(execution["exercise_id"])

    with Session(database_engine) as db_session:
        exercise = db_session.get(
            Exercise,
            exercise_id,
        )

        assert exercise is not None

        exercise.name = "Renamed Current Exercise"
        db_session.commit()

    history_response = client.get(
        "/api/v1/training/history",
        headers=authorization_headers(authentication),
    )

    assert history_response.status_code == 200

    history = cast(
        list[WorkoutHistoryPayload],
        history_response.json(),
    )

    assert len(history) == 1
    assert history[0]["workout_name"] == "Original Push"

    detail_response = client.get(
        (f"/api/v1/training/sessions/{workout_session['id']}"),
        headers=authorization_headers(authentication),
    )

    assert detail_response.status_code == 200

    historical = cast(
        WorkoutSessionPayload,
        detail_response.json(),
    )

    assert historical["workout_name"] == "Original Push"

    historical_execution = historical["exercises"][0]

    assert historical_execution["exercise_name"] == ("Original Bench Press")
    assert historical_execution["planned_sets"] == 4
    assert historical_execution["planned_repetitions"] == 10
    assert historical_execution["planned_load"] == "60.00"
    assert historical_execution["planned_load_unit"] == "kg"
    assert historical_execution["planned_notes"] == ("Original planned notes.")

    historical_set = historical_execution["sets"][0]

    assert historical_set["repetitions"] == 9
    assert historical_set["load"] == "62.50"
    assert historical_set["load_unit"] == "kg"


def test_user_cannot_open_another_users_historical_session(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    owner = register_user(
        client=client,
        created_emails=created_emails,
        name="Owner",
    )
    other_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Other User",
    )

    workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=owner,
        catalog_exercise_ids=catalog_exercise_ids,
        workout_name="Private Workout",
        exercise_name="Private Exercise",
    )

    workout_session = start_session(
        client=client,
        authentication=owner,
        workout_id=workout["id"],
    )

    finish_session(
        client=client,
        authentication=owner,
        workout_session_id=workout_session["id"],
    )

    response = client.get(
        (f"/api/v1/training/sessions/{workout_session['id']}"),
        headers=authorization_headers(other_user),
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "workout_session_not_found",
            "message": "Workout session was not found.",
        }
    }
