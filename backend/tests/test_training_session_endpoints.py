from collections.abc import Iterator
from typing import TypedDict, cast
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.training.models import Exercise


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
    name: str = "Session API User",
) -> AuthPayload:
    email = f"session-api-{uuid4()}@example.com"
    created_emails.append(email)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "Aa1!bcde",
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
    name: str = "Session API Bench Press",
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


def create_workout(
    *,
    client: TestClient,
    authentication: AuthPayload,
    name: str = "Session API Workout",
) -> WorkoutPayload:
    response = client.post(
        "/api/v1/training/workouts",
        headers=authorization_headers(authentication),
        json={
            "name": name,
        },
    )

    assert response.status_code == 201

    return cast(
        WorkoutPayload,
        response.json(),
    )


def create_configured_workout(
    *,
    client: TestClient,
    database_engine: Engine,
    authentication: AuthPayload,
    catalog_exercise_ids: list[UUID],
    name: str = "Push Day",
) -> WorkoutPayload:
    workout = create_workout(
        client=client,
        authentication=authentication,
        name=name,
    )

    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
    )

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": str(exercise.id),
            "target_sets": 4,
            "target_repetitions": 10,
            "target_load": "60.00",
            "target_load_unit": "kg",
            "notes": "Controlled eccentric.",
        },
    )

    assert response.status_code == 201

    return cast(
        WorkoutPayload,
        response.json(),
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


def test_session_endpoints_require_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/training/sessions/active",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_active_session_is_null_before_session_starts(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.get(
        "/api/v1/training/sessions/active",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200
    assert response.json() is None


def test_configured_workout_can_start_session_with_snapshot(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    assert session["source_workout_id"] == workout["id"]
    assert session["workout_name"] == "Push Day"
    assert session["status"] == "active"
    assert session["completed_at"] is None
    assert session["cancelled_at"] is None
    assert len(session["exercises"]) == 1

    execution = session["exercises"][0]

    assert execution["exercise_name"] == "Session API Bench Press"
    assert execution["position"] == 1
    assert execution["planned_sets"] == 4
    assert execution["planned_repetitions"] == 10
    assert execution["planned_load"] == "60.00"
    assert execution["planned_load_unit"] == "kg"
    assert execution["planned_notes"] == "Controlled eccentric."
    assert execution["sets"] == []


def test_empty_workout_cannot_start_session(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    workout = create_workout(
        client=client,
        authentication=authentication,
        name="Empty Workout",
    )

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/sessions",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "workout_session_source_empty",
            "message": ("Workout must contain at least one exercise before a session can start."),
        }
    }


def test_archived_workout_cannot_start_session(
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
    )

    archive_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/archive",
        headers=authorization_headers(authentication),
    )

    assert archive_response.status_code == 200

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/sessions",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "workout_session_source_unavailable",
            "message": "Archived workout cannot start a session.",
        }
    }


def test_user_cannot_start_second_active_session(
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
        name="First Workout",
    )

    second_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Second Workout",
    )

    start_session(
        client=client,
        authentication=authentication,
        workout_id=first_workout["id"],
    )

    response = client.post(
        f"/api/v1/training/workouts/{second_workout['id']}/sessions",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "active_workout_session_exists",
            "message": "User already has an active workout session.",
        }
    }


def test_actual_set_can_be_created_and_updated(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    execution = session["exercises"][0]

    create_response = client.post(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 9,
            "load": "62.50",
            "load_unit": "kg",
        },
    )

    assert create_response.status_code == 201

    updated_session = cast(
        WorkoutSessionPayload,
        create_response.json(),
    )
    recorded_set = updated_session["exercises"][0]["sets"][0]

    assert recorded_set["position"] == 1
    assert recorded_set["repetitions"] == 9
    assert recorded_set["load"] == "62.50"
    assert recorded_set["load_unit"] == "kg"

    update_response = client.patch(
        (
            f"/api/v1/training/sessions/{session['id']}"
            f"/exercises/{execution['id']}"
            f"/sets/{recorded_set['id']}"
        ),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 10,
            "load": "65.00",
            "load_unit": "kg",
        },
    )

    assert update_response.status_code == 200

    corrected = cast(
        WorkoutSessionPayload,
        update_response.json(),
    )["exercises"][0]["sets"][0]

    assert corrected["repetitions"] == 10
    assert corrected["load"] == "65.00"
    assert corrected["load_unit"] == "kg"


def test_invalid_set_payload_is_rejected(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    execution = session["exercises"][0]

    response = client.post(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 10,
            "load": "50.00",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }


def test_session_and_exercise_can_record_notes_and_completion(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    execution = session["exercises"][0]

    session_response = client.patch(
        f"/api/v1/training/sessions/{session['id']}",
        headers=authorization_headers(authentication),
        json={
            "notes": "Strong session.",
        },
    )

    assert session_response.status_code == 200
    assert session_response.json()["notes"] == "Strong session."

    exercise_response = client.patch(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}"),
        headers=authorization_headers(authentication),
        json={
            "notes": "Last repetitions were difficult.",
            "completed": True,
        },
    )

    assert exercise_response.status_code == 200

    updated = cast(
        WorkoutSessionPayload,
        exercise_response.json(),
    )
    updated_execution = updated["exercises"][0]

    assert updated_execution["notes"] == ("Last repetitions were difficult.")
    assert updated_execution["is_completed"] is True
    assert updated_execution["completed_at"] is not None


def test_deleting_set_compacts_positions(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    execution = session["exercises"][0]

    current_session = session

    for repetitions in [
        10,
        9,
        8,
    ]:
        response = client.post(
            (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
            headers=authorization_headers(authentication),
            json={
                "repetitions": repetitions,
            },
        )

        assert response.status_code == 201
        current_session = cast(
            WorkoutSessionPayload,
            response.json(),
        )

    sets = current_session["exercises"][0]["sets"]

    response = client.delete(
        (
            f"/api/v1/training/sessions/{session['id']}"
            f"/exercises/{execution['id']}"
            f"/sets/{sets[1]['id']}"
        ),
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 204

    get_response = client.get(
        f"/api/v1/training/sessions/{session['id']}",
        headers=authorization_headers(authentication),
    )

    assert get_response.status_code == 200

    persisted = cast(
        WorkoutSessionPayload,
        get_response.json(),
    )
    remaining_sets = persisted["exercises"][0]["sets"]

    assert [item["repetitions"] for item in remaining_sets] == [
        10,
        8,
    ]
    assert [item["position"] for item in remaining_sets] == [
        1,
        2,
    ]


def test_finishing_session_preserves_execution_and_blocks_changes(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )
    execution = session["exercises"][0]

    record_response = client.post(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 9,
            "load": "62.50",
            "load_unit": "kg",
        },
    )

    assert record_response.status_code == 201

    finish_response = client.post(
        f"/api/v1/training/sessions/{session['id']}/finish",
        headers=authorization_headers(authentication),
    )

    assert finish_response.status_code == 200

    completed = cast(
        WorkoutSessionPayload,
        finish_response.json(),
    )

    assert completed["status"] == "completed"
    assert completed["completed_at"] is not None
    assert len(completed["exercises"][0]["sets"]) == 1

    active_response = client.get(
        "/api/v1/training/sessions/active",
        headers=authorization_headers(authentication),
    )

    assert active_response.status_code == 200
    assert active_response.json() is None

    mutation_response = client.post(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 8,
        },
    )

    assert mutation_response.status_code == 409
    assert mutation_response.json() == {
        "error": {
            "code": "workout_session_not_active",
            "message": "Workout session is no longer active.",
        }
    }


def test_active_session_can_be_cancelled(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    response = client.post(
        f"/api/v1/training/sessions/{session['id']}/cancel",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    cancelled = cast(
        WorkoutSessionPayload,
        response.json(),
    )

    assert cancelled["status"] == "cancelled"
    assert cancelled["completed_at"] is None
    assert cancelled["cancelled_at"] is not None


def test_user_cannot_access_another_users_private_session(
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
    )

    session = start_session(
        client=client,
        authentication=owner,
        workout_id=workout["id"],
    )

    response = client.get(
        f"/api/v1/training/sessions/{session['id']}",
        headers=authorization_headers(other_user),
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "workout_session_not_found",
            "message": "Workout session was not found.",
        }
    }


def test_completed_session_remains_readable_with_recorded_sets(
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
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )
    execution = session["exercises"][0]

    record_response = client.post(
        (f"/api/v1/training/sessions/{session['id']}/exercises/{execution['id']}/sets"),
        headers=authorization_headers(authentication),
        json={
            "repetitions": 9,
            "load": "62.50",
            "load_unit": "kg",
        },
    )

    assert record_response.status_code == 201

    finish_response = client.post(
        f"/api/v1/training/sessions/{session['id']}/finish",
        headers=authorization_headers(authentication),
    )

    assert finish_response.status_code == 200

    response = client.get(
        f"/api/v1/training/sessions/{session['id']}",
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 200

    historical = cast(
        WorkoutSessionPayload,
        response.json(),
    )

    assert historical["status"] == "completed"
    assert historical["workout_name"] == "Push Day"

    historical_set = historical["exercises"][0]["sets"][0]

    assert historical_set["repetitions"] == 9
    assert historical_set["load"] == "62.50"
    assert historical_set["load_unit"] == "kg"


@pytest.fixture
def execution_note_session(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> tuple[AuthPayload, WorkoutSessionPayload]:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=authentication,
        catalog_exercise_ids=catalog_exercise_ids,
    )

    session = start_session(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
    )

    return authentication, session


def test_execution_notes_persist_normalize_update_and_clear(
    client: TestClient,
    execution_note_session: tuple[AuthPayload, WorkoutSessionPayload],
) -> None:
    authentication, session = execution_note_session
    headers = authorization_headers(authentication)

    session_url = f"/api/v1/training/sessions/{session['id']}"
    exercise_url = f"{session_url}/exercises/{session['exercises'][0]['id']}"

    session_response = client.patch(
        session_url,
        headers=headers,
        json={"notes": "\u0085  Good session.\nSecond  line. \u3000"},
    )

    assert session_response.status_code == 200
    assert session_response.json()["notes"] == "Good session.\nSecond  line."

    exercise_response = client.patch(
        exercise_url,
        headers=headers,
        json={"notes": "  Controlled movement.  "},
    )

    assert exercise_response.status_code == 200

    exercise = exercise_response.json()["exercises"][0]

    assert exercise["notes"] == "Controlled movement."
    assert exercise["planned_notes"] == "Controlled eccentric."
    assert exercise["is_completed"] is False

    persisted = client.get(session_url, headers=headers)

    assert persisted.status_code == 200
    assert persisted.json()["notes"] == "Good session.\nSecond  line."
    assert persisted.json()["exercises"][0]["notes"] == "Controlled movement."

    updated = client.patch(
        session_url,
        headers=headers,
        json={"notes": "Updated workout note."},
    )

    assert updated.status_code == 200
    assert updated.json()["notes"] == "Updated workout note."

    completed = client.patch(
        exercise_url,
        headers=headers,
        json={"completed": True},
    )

    assert completed.status_code == 200

    exercise = completed.json()["exercises"][0]

    assert exercise["is_completed"] is True
    assert exercise["notes"] == "Controlled movement."

    cleared_session = client.patch(
        session_url,
        headers=headers,
        json={"notes": None},
    )

    assert cleared_session.status_code == 200
    assert cleared_session.json()["notes"] is None

    cleared_exercise = client.patch(
        exercise_url,
        headers=headers,
        json={"notes": " \n\t\u0085 "},
    )

    assert cleared_exercise.status_code == 200

    persisted = client.get(session_url, headers=headers)

    assert persisted.status_code == 200

    payload = persisted.json()
    exercise = payload["exercises"][0]

    assert payload["notes"] is None
    assert exercise["notes"] is None
    assert exercise["planned_notes"] == "Controlled eccentric."
    assert exercise["is_completed"] is True


def test_execution_notes_remain_in_completed_workout_history(
    client: TestClient,
    execution_note_session: tuple[AuthPayload, WorkoutSessionPayload],
) -> None:
    authentication, session = execution_note_session
    headers = authorization_headers(authentication)

    session_url = f"/api/v1/training/sessions/{session['id']}"
    exercise_url = f"{session_url}/exercises/{session['exercises'][0]['id']}"

    response = client.patch(
        session_url,
        headers=headers,
        json={"notes": "Overall workout observation."},
    )

    assert response.status_code == 200

    response = client.patch(
        exercise_url,
        headers=headers,
        json={"notes": "Exercise execution observation."},
    )

    assert response.status_code == 200

    set_response = client.post(
        f"{exercise_url}/sets",
        headers=headers,
        json={"repetitions": 10},
    )

    assert set_response.status_code == 201
    assert set_response.json()["notes"] == "Overall workout observation."
    assert set_response.json()["exercises"][0]["notes"] == "Exercise execution observation."

    finished = client.post(
        f"{session_url}/finish",
        headers=headers,
    )

    assert finished.status_code == 200
    assert finished.json()["status"] == "completed"

    history = client.get(
        "/api/v1/training/history",
        headers=headers,
    )

    assert history.status_code == 200

    history_items = history.json()

    assert len(history_items) == 1
    assert history_items[0]["id"] == session["id"]
    assert history_items[0]["notes"] == "Overall workout observation."

    details = client.get(session_url, headers=headers)

    assert details.status_code == 200

    historical = details.json()
    exercise = historical["exercises"][0]

    assert historical["notes"] == "Overall workout observation."
    assert exercise["notes"] == "Exercise execution observation."
    assert exercise["planned_notes"] == "Controlled eccentric."
    assert exercise["sets"][0]["repetitions"] == 10


@pytest.mark.parametrize(
    ("action", "expected_status"),
    [
        ("finish", "completed"),
        ("cancel", "cancelled"),
    ],
)
def test_execution_notes_cannot_change_after_session_ends(
    client: TestClient,
    execution_note_session: tuple[AuthPayload, WorkoutSessionPayload],
    action: str,
    expected_status: str,
) -> None:
    authentication, session = execution_note_session
    headers = authorization_headers(authentication)

    session_url = f"/api/v1/training/sessions/{session['id']}"
    exercise_url = f"{session_url}/exercises/{session['exercises'][0]['id']}"

    for url in (session_url, exercise_url):
        response = client.patch(
            url,
            headers=headers,
            json={"notes": "Preserved note."},
        )

        assert response.status_code == 200

    ended = client.post(
        f"{session_url}/{action}",
        headers=headers,
    )

    assert ended.status_code == 200
    assert ended.json()["status"] == expected_status

    for url in (session_url, exercise_url):
        response = client.patch(
            url,
            headers=headers,
            json={"notes": "Unauthorized modification."},
        )

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "workout_session_not_active"

    persisted = client.get(session_url, headers=headers)

    assert persisted.status_code == 200
    assert persisted.json()["notes"] == "Preserved note."
    assert persisted.json()["exercises"][0]["notes"] == "Preserved note."


def test_execution_notes_are_isolated_between_users(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
    execution_note_session: tuple[AuthPayload, WorkoutSessionPayload],
) -> None:
    owner, session = execution_note_session

    other_user = register_user(
        client=client,
        created_emails=created_emails,
        name="Other Notes User",
    )

    owner_headers = authorization_headers(owner)
    other_headers = authorization_headers(other_user)

    session_url = f"/api/v1/training/sessions/{session['id']}"
    exercise_url = f"{session_url}/exercises/{session['exercises'][0]['id']}"

    for url in (session_url, exercise_url):
        response = client.patch(
            url,
            headers=owner_headers,
            json={"notes": "Private note."},
        )

        assert response.status_code == 200

        unauthorized = client.patch(
            url,
            json={"notes": "Unauthorized note."},
        )

        assert unauthorized.status_code == 401

        forbidden = client.patch(
            url,
            headers=other_headers,
            json={"notes": "Another user's modification."},
        )

        assert forbidden.status_code == 404
        assert forbidden.json()["error"]["code"] == "workout_session_not_found"

    other_workout = create_configured_workout(
        client=client,
        database_engine=database_engine,
        authentication=other_user,
        catalog_exercise_ids=catalog_exercise_ids,
    )

    other_session = start_session(
        client=client,
        authentication=other_user,
        workout_id=other_workout["id"],
    )

    foreign_exercise_id = other_session["exercises"][0]["id"]

    wrong_execution = client.patch(
        f"{session_url}/exercises/{foreign_exercise_id}",
        headers=owner_headers,
        json={"notes": "Cross-session modification."},
    )

    assert wrong_execution.status_code == 404
    assert wrong_execution.json()["error"]["code"] == "exercise_execution_not_found"

    persisted = client.get(session_url, headers=owner_headers)

    assert persisted.status_code == 200
    assert persisted.json()["notes"] == "Private note."
    assert persisted.json()["exercises"][0]["notes"] == "Private note."

    other_details = client.get(
        f"/api/v1/training/sessions/{other_session['id']}",
        headers=other_headers,
    )

    assert other_details.status_code == 200
    assert other_details.json()["exercises"][0]["notes"] is None


def test_execution_notes_reject_invalid_payloads_without_changes(
    client: TestClient,
    execution_note_session: tuple[AuthPayload, WorkoutSessionPayload],
) -> None:
    authentication, session = execution_note_session
    headers = authorization_headers(authentication)

    session_url = f"/api/v1/training/sessions/{session['id']}"
    exercise_url = f"{session_url}/exercises/{session['exercises'][0]['id']}"

    for url in (session_url, exercise_url):
        response = client.patch(
            url,
            headers=headers,
            json={"notes": "Original note."},
        )

        assert response.status_code == 200

        for invalid_payload in (
            {},
            {"notes": 123},
            {"notes": ["Invalid"]},
            {"notes": "Unexpected update.", "unknown": True},
        ):
            invalid = client.patch(
                url,
                headers=headers,
                json=invalid_payload,
            )

            assert invalid.status_code == 422

    persisted = client.get(session_url, headers=headers)

    assert persisted.status_code == 200
    assert persisted.json()["notes"] == "Original note."
    assert persisted.json()["exercises"][0]["notes"] == "Original note."
    assert persisted.json()["exercises"][0]["is_completed"] is False
