import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import literal, select, tuple_
from sqlalchemy.orm import Session

from fitmap.media.storage import (
    ObjectStorageError,
    PrivateObjectStorage,
    build_progress_photo_storage_key,
)
from fitmap.media.validation import validate_progress_photo
from fitmap.pagination import (
    InvalidPaginationCursorError,
    validate_page_limit,
)
from fitmap.progress.models import ProgressPhoto
from fitmap.training.models import WorkoutSession

logger = logging.getLogger(__name__)


class ProgressPhotoError(Exception):
    pass


class ProgressPhotoNotFoundError(ProgressPhotoError):
    pass


class ProgressPhotoWorkoutSessionNotFoundError(ProgressPhotoError):
    pass


def discard_uncommitted_photo(
    *,
    storage: PrivateObjectStorage,
    storage_key: str,
) -> None:
    try:
        storage.delete_object(key=storage_key)
    except ObjectStorageError:
        logger.warning("Unable to clean up uncommitted progress photo.")


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

    progress_photo = ProgressPhoto(
        user_id=user_id,
        workout_session_id=workout_session_id,
        storage_key=storage_key,
        media_type=validated_image.media_type,
        recorded_at=recorded_at,
    )

    db_session.add(progress_photo)
    db_session.flush()

    try:
        storage.put_object(
            key=storage_key,
            data=validated_image.data,
            media_type=validated_image.media_type,
        )
    except ObjectStorageError:
        discard_uncommitted_photo(
            storage=storage,
            storage_key=storage_key,
        )
        raise

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


def list_progress_photos_page(
    *,
    db_session: Session,
    user_id: UUID,
    limit: int,
    cursor: UUID | None = None,
) -> tuple[list[ProgressPhoto], UUID | None]:
    validate_page_limit(limit)

    statement = select(ProgressPhoto).where(
        ProgressPhoto.user_id == user_id,
    )

    if cursor is not None:
        anchor = db_session.scalar(
            statement.where(
                ProgressPhoto.id == cursor,
            )
        )

        if anchor is None:
            raise InvalidPaginationCursorError("Invalid pagination cursor.")

        statement = statement.where(
            tuple_(
                ProgressPhoto.recorded_at,
                ProgressPhoto.id,
            )
            < tuple_(
                literal(anchor.recorded_at),
                literal(anchor.id),
            )
        )

    statement = statement.order_by(
        ProgressPhoto.recorded_at.desc(),
        ProgressPhoto.id.desc(),
    ).limit(limit + 1)

    rows = list(db_session.scalars(statement).all())

    items = rows[:limit]

    next_cursor = items[-1].id if len(rows) > limit else None

    return items, next_cursor


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
