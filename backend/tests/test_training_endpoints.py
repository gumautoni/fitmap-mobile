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


class ExercisePayload(TypedDict):
    id: str
    name: str
    origin: str
    is_archived: bool
    created_at: str
    updated_at: str


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
    name: str = "Training User",
) -> AuthPayload:
    email = f"training-endpoint-{uuid4()}@example.com"
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


def create_workout(
    *,
    client: TestClient,
    authentication: AuthPayload,
    name: str = "Workout A",
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


def add_exercise(
    *,
    client: TestClient,
    authentication: AuthPayload,
    workout_id: str,
    exercise_id: str,
) -> WorkoutPayload:
    response = client.post(
        f"/api/v1/training/workouts/{workout_id}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": exercise_id,
        },
    )

    assert response.status_code == 201

    return cast(
        WorkoutPayload,
        response.json(),
    )


def test_training_endpoints_require_authentication(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/training/exercises",
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "invalid_access_token",
            "message": "Invalid or expired access token.",
        }
    }


def test_create_custom_exercise_returns_authenticated_users_exercise(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        "/api/v1/training/exercises",
        headers=authorization_headers(authentication),
        json={
            "name": "  Incline   Cable   Press  ",
        },
    )

    assert response.status_code == 201

    exercise = cast(
        ExercisePayload,
        response.json(),
    )

    assert exercise["name"] == "Incline Cable Press"
    assert exercise["origin"] == "custom"
    assert exercise["is_archived"] is False


def test_exercise_catalog_contains_global_and_own_custom_exercises_only(
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

    catalog_exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Barbell Bench Press",
    )

    first_response = client.post(
        "/api/v1/training/exercises",
        headers=authorization_headers(first_user),
        json={
            "name": "First Custom Exercise",
        },
    )
    second_response = client.post(
        "/api/v1/training/exercises",
        headers=authorization_headers(second_user),
        json={
            "name": "Second Custom Exercise",
        },
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201

    first_custom = cast(
        ExercisePayload,
        first_response.json(),
    )
    second_custom = cast(
        ExercisePayload,
        second_response.json(),
    )

    response = client.get(
        "/api/v1/training/exercises",
        headers=authorization_headers(first_user),
    )

    assert response.status_code == 200

    exercises = cast(
        list[ExercisePayload],
        response.json(),
    )

    exercise_ids = {exercise["id"] for exercise in exercises}

    assert str(catalog_exercise.id) in exercise_ids
    assert first_custom["id"] in exercise_ids
    assert second_custom["id"] not in exercise_ids


def test_create_workout_normalizes_name_and_starts_empty(
    client: TestClient,
    created_emails: list[str],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )

    response = client.post(
        "/api/v1/training/workouts",
        headers=authorization_headers(authentication),
        json={
            "name": "  Chest   and   Triceps  ",
        },
    )

    assert response.status_code == 201

    workout = cast(
        WorkoutPayload,
        response.json(),
    )

    assert workout["name"] == "Chest and Triceps"
    assert workout["is_archived"] is False
    assert workout["archived_at"] is None
    assert workout["exercises"] == []


def test_workout_list_is_isolated_between_authenticated_users(
    client: TestClient,
    created_emails: list[str],
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

    first_workout = create_workout(
        client=client,
        authentication=first_user,
        name="First Workout",
    )
    second_workout = create_workout(
        client=client,
        authentication=second_user,
        name="Second Workout",
    )

    response = client.get(
        "/api/v1/training/workouts",
        headers=authorization_headers(first_user),
    )

    assert response.status_code == 200

    workouts = cast(
        list[dict[str, object]],
        response.json(),
    )

    workout_ids = {cast(str, workout["id"]) for workout in workouts}

    assert first_workout["id"] in workout_ids
    assert second_workout["id"] not in workout_ids


def test_user_cannot_read_another_users_workout(
    client: TestClient,
    created_emails: list[str],
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

    workout = create_workout(
        client=client,
        authentication=owner,
        name="Private Workout",
    )

    response = client.get(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(other_user),
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "workout_not_found",
            "message": "Workout was not found.",
        }
    }


def test_workout_can_be_renamed(
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
    )

    response = client.patch(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(authentication),
        json={
            "name": "  Push   Day  ",
        },
    )

    assert response.status_code == 200

    updated = cast(
        WorkoutPayload,
        response.json(),
    )

    assert updated["name"] == "Push Day"


def test_empty_workout_update_is_rejected(
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
    )

    response = client.patch(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(authentication),
        json={},
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }


def test_workout_can_be_archived_hidden_and_restored(
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
        name="Push",
    )

    archive_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/archive",
        headers=authorization_headers(authentication),
    )

    assert archive_response.status_code == 200

    archived = cast(
        WorkoutPayload,
        archive_response.json(),
    )

    assert archived["is_archived"] is True
    assert archived["archived_at"] is not None

    active_response = client.get(
        "/api/v1/training/workouts",
        headers=authorization_headers(authentication),
    )

    assert active_response.status_code == 200
    assert all(item["id"] != workout["id"] for item in active_response.json())

    all_response = client.get(
        "/api/v1/training/workouts?include_archived=true",
        headers=authorization_headers(authentication),
    )

    assert all_response.status_code == 200
    assert any(item["id"] == workout["id"] for item in all_response.json())

    restore_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/restore",
        headers=authorization_headers(authentication),
    )

    assert restore_response.status_code == 200

    restored = cast(
        WorkoutPayload,
        restore_response.json(),
    )

    assert restored["is_archived"] is False
    assert restored["archived_at"] is None


def test_archived_workout_cannot_be_modified(
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
    )

    archive_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/archive",
        headers=authorization_headers(authentication),
    )

    assert archive_response.status_code == 200

    response = client.patch(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(authentication),
        json={
            "name": "Blocked Rename",
        },
    )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "workout_archived",
            "message": "Archived workout cannot be modified.",
        }
    }


def test_catalog_exercise_can_be_added_to_workout(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
        name="Push",
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Barbell Bench Press",
    )

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": str(exercise.id),
            "target_sets": 4,
            "target_repetitions": 8,
            "target_load": "60.00",
            "target_load_unit": "kg",
            "notes": "Controlled movement",
        },
    )

    assert response.status_code == 201

    updated = cast(
        WorkoutPayload,
        response.json(),
    )

    assert len(updated["exercises"]) == 1

    planned_exercise = updated["exercises"][0]

    assert planned_exercise["exercise_id"] == str(exercise.id)
    assert planned_exercise["exercise_name"] == "Barbell Bench Press"
    assert planned_exercise["position"] == 1
    assert planned_exercise["target_sets"] == 4
    assert planned_exercise["target_repetitions"] == 8
    assert planned_exercise["target_load"] == "60.00"
    assert planned_exercise["target_load_unit"] == "kg"
    assert planned_exercise["notes"] == "Controlled movement"


def test_user_can_add_own_custom_exercise_to_workout(
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
    )

    exercise_response = client.post(
        "/api/v1/training/exercises",
        headers=authorization_headers(authentication),
        json={
            "name": "My Custom Exercise",
        },
    )

    assert exercise_response.status_code == 201

    exercise = cast(
        ExercisePayload,
        exercise_response.json(),
    )

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": exercise["id"],
        },
    )

    assert response.status_code == 201

    updated = cast(
        WorkoutPayload,
        response.json(),
    )

    assert updated["exercises"][0]["exercise_id"] == exercise["id"]


def test_user_cannot_add_another_users_custom_exercise(
    client: TestClient,
    created_emails: list[str],
) -> None:
    exercise_owner = register_user(
        client=client,
        created_emails=created_emails,
        name="Exercise Owner",
    )
    workout_owner = register_user(
        client=client,
        created_emails=created_emails,
        name="Workout Owner",
    )

    exercise_response = client.post(
        "/api/v1/training/exercises",
        headers=authorization_headers(exercise_owner),
        json={
            "name": "Private Exercise",
        },
    )

    assert exercise_response.status_code == 201

    exercise = cast(
        ExercisePayload,
        exercise_response.json(),
    )

    workout = create_workout(
        client=client,
        authentication=workout_owner,
    )

    response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(workout_owner),
        json={
            "exercise_id": exercise["id"],
        },
    )

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "exercise_unavailable",
            "message": "Exercise is unavailable.",
        }
    }


def test_workout_exercise_can_be_updated(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Bench Press",
    )

    workout = add_exercise(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
        exercise_id=str(exercise.id),
    )

    workout_exercise = workout["exercises"][0]

    response = client.patch(
        (f"/api/v1/training/workouts/{workout['id']}/exercises/{workout_exercise['id']}"),
        headers=authorization_headers(authentication),
        json={
            "target_sets": 4,
            "target_repetitions": 8,
            "target_load": "70.00",
            "target_load_unit": "kg",
            "notes": "Progressive overload",
        },
    )

    assert response.status_code == 200

    updated = cast(
        WorkoutPayload,
        response.json(),
    )

    planned_exercise = updated["exercises"][0]

    assert planned_exercise["target_sets"] == 4
    assert planned_exercise["target_repetitions"] == 8
    assert planned_exercise["target_load"] == "70.00"
    assert planned_exercise["target_load_unit"] == "kg"
    assert planned_exercise["notes"] == "Progressive overload"


def test_invalid_partial_load_update_is_rejected(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
    )
    exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Bench Press",
    )

    add_response = client.post(
        f"/api/v1/training/workouts/{workout['id']}/exercises",
        headers=authorization_headers(authentication),
        json={
            "exercise_id": str(exercise.id),
            "target_load": "50.00",
            "target_load_unit": "kg",
        },
    )

    assert add_response.status_code == 201

    updated_workout = cast(
        WorkoutPayload,
        add_response.json(),
    )
    workout_exercise = updated_workout["exercises"][0]

    response = client.patch(
        (f"/api/v1/training/workouts/{workout['id']}/exercises/{workout_exercise['id']}"),
        headers=authorization_headers(authentication),
        json={
            "target_load_unit": None,
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }


def test_removing_exercise_compacts_workout_positions(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
    )

    exercises = [
        create_catalog_exercise(
            database_engine=database_engine,
            catalog_exercise_ids=catalog_exercise_ids,
            name=f"Exercise {index}",
        )
        for index in range(1, 4)
    ]

    for exercise in exercises:
        workout = add_exercise(
            client=client,
            authentication=authentication,
            workout_id=workout["id"],
            exercise_id=str(exercise.id),
        )

    second = workout["exercises"][1]

    response = client.delete(
        (f"/api/v1/training/workouts/{workout['id']}/exercises/{second['id']}"),
        headers=authorization_headers(authentication),
    )

    assert response.status_code == 204

    get_response = client.get(
        f"/api/v1/training/workouts/{workout['id']}",
        headers=authorization_headers(authentication),
    )

    assert get_response.status_code == 200

    updated = cast(
        WorkoutPayload,
        get_response.json(),
    )

    assert [item["exercise_id"] for item in updated["exercises"]] == [
        str(exercises[0].id),
        str(exercises[2].id),
    ]

    assert [item["position"] for item in updated["exercises"]] == [
        1,
        2,
    ]


def test_workout_exercises_can_be_reordered(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
    )

    exercises = [
        create_catalog_exercise(
            database_engine=database_engine,
            catalog_exercise_ids=catalog_exercise_ids,
            name=f"Exercise {index}",
        )
        for index in range(1, 4)
    ]

    for exercise in exercises:
        workout = add_exercise(
            client=client,
            authentication=authentication,
            workout_id=workout["id"],
            exercise_id=str(exercise.id),
        )

    first = workout["exercises"][0]
    second = workout["exercises"][1]
    third = workout["exercises"][2]

    response = client.put(
        (f"/api/v1/training/workouts/{workout['id']}/exercises/reorder"),
        headers=authorization_headers(authentication),
        json={
            "workout_exercise_ids": [
                third["id"],
                first["id"],
                second["id"],
            ]
        },
    )

    assert response.status_code == 200

    reordered = cast(
        WorkoutPayload,
        response.json(),
    )

    assert [item["id"] for item in reordered["exercises"]] == [
        third["id"],
        first["id"],
        second["id"],
    ]

    assert [item["position"] for item in reordered["exercises"]] == [
        1,
        2,
        3,
    ]


def test_invalid_reorder_is_rejected(
    client: TestClient,
    database_engine: Engine,
    created_emails: list[str],
    catalog_exercise_ids: list[UUID],
) -> None:
    authentication = register_user(
        client=client,
        created_emails=created_emails,
    )
    workout = create_workout(
        client=client,
        authentication=authentication,
    )

    first_exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Exercise A",
    )
    second_exercise = create_catalog_exercise(
        database_engine=database_engine,
        catalog_exercise_ids=catalog_exercise_ids,
        name="Exercise B",
    )

    workout = add_exercise(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
        exercise_id=str(first_exercise.id),
    )
    workout = add_exercise(
        client=client,
        authentication=authentication,
        workout_id=workout["id"],
        exercise_id=str(second_exercise.id),
    )

    response = client.put(
        (f"/api/v1/training/workouts/{workout['id']}/exercises/reorder"),
        headers=authorization_headers(authentication),
        json={
            "workout_exercise_ids": [
                workout["exercises"][0]["id"],
            ]
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "request_validation_error",
            "message": "Request validation failed.",
        }
    }
