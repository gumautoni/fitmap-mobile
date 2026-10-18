from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.media.storage import StoredMedia
from fitmap.progress.photos import (
    ProgressPhotoWorkoutSessionNotFoundError,
    create_progress_photo,
    list_progress_photos,
)
from fitmap.training.models import WorkoutSession


class InMemoryPrivateObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[str, StoredMedia] = {}

    def put_object(
        self,
        *,
        key: str,
        data: bytes,
        media_type: str,
    ) -> None:
        self.objects[key] = StoredMedia(
            data=data,
            media_type=media_type,
        )

    def get_object(
        self,
        *,
        key: str,
    ) -> StoredMedia:
        return self.objects[key]

    def delete_object(
        self,
        *,
        key: str,
    ) -> None:
        self.objects.pop(key, None)


@pytest.fixture
def created_user_ids() -> Iterator[list[UUID]]:
    user_ids: list[UUID] = []
    yield user_ids


@pytest.fixture(autouse=True)
def cleanup_progress_photo_records(
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> Iterator[None]:
    yield

    if not created_user_ids:
        return

    with database_engine.begin() as connection:
        connection.execute(
            delete(User).where(
                User.id.in_(created_user_ids),
            )
        )


def create_user(
    *,
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> User:
    with Session(
        database_engine,
        expire_on_commit=False,
    ) as db_session:
        user = User(
            name="Progress Photo User",
            email=f"progress-photo-{uuid4()}@example.com",
            password_hash="test-password-hash",
        )

        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        created_user_ids.append(user.id)

        return user


def create_workout_session(
    *,
    database_engine: Engine,
    user_id: UUID,
) -> WorkoutSession:
    with Session(
        database_engine,
        expire_on_commit=False,
    ) as db_session:
        workout_session = WorkoutSession(
            user_id=user_id,
            workout_name="Progress Photo Workout",
        )

        db_session.add(workout_session)
        db_session.commit()
        db_session.refresh(workout_session)

        return workout_session


def test_progress_photo_can_be_created_without_workout_session(
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> None:
    user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    storage = InMemoryPrivateObjectStorage()
    recorded_at = datetime.now(UTC)

    with Session(database_engine) as db_session:
        progress_photo = create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=user.id,
            data=b"\xff\xd8\xffimage-data",
            media_type="image/jpeg",
            recorded_at=recorded_at,
        )

        db_session.commit()
        db_session.refresh(progress_photo)

        assert progress_photo.user_id == user.id
        assert progress_photo.workout_session_id is None
        assert progress_photo.media_type == "image/jpeg"
        assert progress_photo.recorded_at == recorded_at
        assert progress_photo.storage_key in storage.objects


def test_progress_photo_can_reference_owned_workout_session(
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> None:
    user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    workout_session = create_workout_session(
        database_engine=database_engine,
        user_id=user.id,
    )
    storage = InMemoryPrivateObjectStorage()

    with Session(database_engine) as db_session:
        progress_photo = create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=user.id,
            data=b"\x89PNG\r\n\x1a\nimage-data",
            media_type="image/png",
            recorded_at=datetime.now(UTC),
            workout_session_id=workout_session.id,
        )

        db_session.commit()

        assert progress_photo.workout_session_id == workout_session.id


def test_progress_photo_rejects_another_users_workout_session(
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> None:
    first_user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    second_user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    workout_session = create_workout_session(
        database_engine=database_engine,
        user_id=second_user.id,
    )
    storage = InMemoryPrivateObjectStorage()

    with (
        Session(database_engine) as db_session,
        pytest.raises(
            ProgressPhotoWorkoutSessionNotFoundError,
            match="Workout session was not found",
        ),
    ):
        create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=first_user.id,
            data=b"\xff\xd8\xffimage-data",
            media_type="image/jpeg",
            recorded_at=datetime.now(UTC),
            workout_session_id=workout_session.id,
        )

    assert storage.objects == {}


def test_progress_photo_list_is_private_and_newest_first(
    database_engine: Engine,
    created_user_ids: list[UUID],
) -> None:
    first_user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    second_user = create_user(
        database_engine=database_engine,
        created_user_ids=created_user_ids,
    )
    storage = InMemoryPrivateObjectStorage()

    older_recorded_at = datetime(2026, 10, 1, 12, tzinfo=UTC)
    newer_recorded_at = datetime(2026, 10, 10, 12, tzinfo=UTC)

    with Session(database_engine) as db_session:
        older_photo = create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=first_user.id,
            data=b"\xff\xd8\xffolder-image",
            media_type="image/jpeg",
            recorded_at=older_recorded_at,
        )
        newer_photo = create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=first_user.id,
            data=b"\xff\xd8\xffnewer-image",
            media_type="image/jpeg",
            recorded_at=newer_recorded_at,
        )
        create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=second_user.id,
            data=b"\xff\xd8\xffother-user-image",
            media_type="image/jpeg",
            recorded_at=datetime.now(UTC),
        )

        db_session.commit()

        photos = list_progress_photos(
            db_session=db_session,
            user_id=first_user.id,
        )

        assert [photo.id for photo in photos] == [
            newer_photo.id,
            older_photo.id,
        ]
