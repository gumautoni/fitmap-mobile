from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.media.storage import (
    PrivateObjectStorage,
    build_progress_photo_storage_key,
)
from fitmap.media.validation import validate_progress_photo
from fitmap.progress.models import ProgressPhoto
from fitmap.training.models import WorkoutSession


class ProgressPhotoError(Exception):
    pass


class ProgressPhotoNotFoundError(ProgressPhotoError):
    pass


class ProgressPhotoWorkoutSessionNotFoundError(ProgressPhotoError):
    pass


def create_progress_photo(
    *,
    db_session: Session,
    storage: PrivateObjectStorage,
    user_id: UUID,
    data: bytes,
    media_type: str,
    recorded_at: datetime,
    workout_session_id: UUID | None = None,
) -> ProgressPhoto:
    validated_image = validate_progress_photo(
        data=data,
        media_type=media_type,
    )

    if workout_session_id is not None:
        workout_session = db_session.scalar(
            select(WorkoutSession).where(
                WorkoutSession.id == workout_session_id,
                WorkoutSession.user_id == user_id,
            )
        )

        if workout_session is None:
            raise ProgressPhotoWorkoutSessionNotFoundError("Workout session was not found.")

    storage_key = build_progress_photo_storage_key(
        user_id=user_id,
    )

    storage.put_object(
        key=storage_key,
        data=validated_image.data,
        media_type=validated_image.media_type,
    )

    progress_photo = ProgressPhoto(
        user_id=user_id,
        workout_session_id=workout_session_id,
        storage_key=storage_key,
        media_type=validated_image.media_type,
        recorded_at=recorded_at,
    )

    db_session.add(progress_photo)
    db_session.flush()

    return progress_photo


def list_progress_photos(
    *,
    db_session: Session,
    user_id: UUID,
) -> list[ProgressPhoto]:
    statement = (
        select(ProgressPhoto)
        .where(
            ProgressPhoto.user_id == user_id,
        )
        .order_by(
            ProgressPhoto.recorded_at.desc(),
            ProgressPhoto.id.desc(),
        )
    )

    return list(db_session.scalars(statement).all())


def get_owned_progress_photo(
    *,
    db_session: Session,
    user_id: UUID,
    progress_photo_id: UUID,
) -> ProgressPhoto:
    progress_photo = db_session.scalar(
        select(ProgressPhoto).where(
            ProgressPhoto.id == progress_photo_id,
            ProgressPhoto.user_id == user_id,
        )
    )

    if progress_photo is None:
        raise ProgressPhotoNotFoundError("Progress photo was not found.")

    return progress_photo
