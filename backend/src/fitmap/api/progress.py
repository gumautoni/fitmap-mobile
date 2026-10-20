from collections.abc import Iterator
from contextlib import suppress
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.media.config import get_media_storage_settings
from fitmap.media.factory import create_private_object_storage
from fitmap.media.storage import (
    ObjectNotFoundError,
    ObjectStorageError,
    PrivateObjectStorage,
)
from fitmap.media.validation import (
    MAX_IMAGE_SIZE_BYTES,
    InvalidMediaError,
)
from fitmap.progress.performance import list_exercise_performance
from fitmap.progress.photos import (
    ProgressPhotoNotFoundError,
    ProgressPhotoWorkoutSessionNotFoundError,
    create_progress_photo,
    get_owned_progress_photo,
    list_progress_photos,
)
from fitmap.progress.schemas import (
    BasicProgressStatisticsResponse,
    ExerciseLoadMaximumResponse,
    ExercisePerformancePointResponse,
    ExercisePerformanceResponse,
    ProgressPhotoResponse,
)
from fitmap.progress.statistics import get_basic_progress_statistics
from fitmap.training.schemas import LoadUnit

router = APIRouter(
    prefix="/progress",
    tags=["progress"],
)


def get_private_object_storage() -> Iterator[PrivateObjectStorage]:
    settings = get_media_storage_settings()

    yield create_private_object_storage(
        settings=settings,
    )


PrivateObjectStorageDependency = Annotated[
    PrivateObjectStorage,
    Depends(get_private_object_storage),
]


@router.get(
    "/statistics",
    response_model=BasicProgressStatisticsResponse,
)
def get_progress_statistics(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> BasicProgressStatisticsResponse:
    statistics = get_basic_progress_statistics(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return BasicProgressStatisticsResponse(
        completed_workouts=statistics.completed_workouts,
        completed_workouts_last_7_days=statistics.completed_workouts_last_7_days,
        completed_workouts_last_30_days=statistics.completed_workouts_last_30_days,
        training_days_last_30_days=statistics.training_days_last_30_days,
        total_performed_sets=statistics.total_performed_sets,
    )


@router.get(
    "/exercises/performance",
    response_model=list[ExercisePerformanceResponse],
)
def get_exercise_performance(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[ExercisePerformanceResponse]:
    performance_series = list_exercise_performance(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [
        ExercisePerformanceResponse(
            exercise_id=series.exercise_id,
            exercise_name=series.exercise_name,
            points=[
                ExercisePerformancePointResponse(
                    workout_session_id=point.workout_session_id,
                    completed_at=point.completed_at,
                    performed_sets=point.performed_sets,
                    total_repetitions=point.total_repetitions,
                    max_loads=[
                        ExerciseLoadMaximumResponse(
                            load_unit=LoadUnit(load.load_unit),
                            max_load=load.max_load,
                        )
                        for load in point.max_loads
                    ],
                )
                for point in series.points
            ],
        )
        for series in performance_series
    ]


@router.post(
    "/photos",
    response_model=ProgressPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_progress_photo(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    storage: PrivateObjectStorageDependency,
    photo: Annotated[UploadFile, File()],
    recorded_at: Annotated[datetime, Form()],
    workout_session_id: Annotated[UUID | None, Form()] = None,
) -> ProgressPhotoResponse:
    data = await photo.read(
        MAX_IMAGE_SIZE_BYTES + 1,
    )

    try:
        progress_photo = create_progress_photo(
            db_session=db_session,
            storage=storage,
            user_id=identity.user.id,
            data=data,
            media_type=photo.content_type or "",
            recorded_at=recorded_at,
            workout_session_id=workout_session_id,
        )
    except InvalidMediaError as exc:
        raise ApiError(
            status_code=422,
            code="invalid_progress_photo",
            message=str(exc),
        ) from exc
    except ProgressPhotoWorkoutSessionNotFoundError as exc:
        raise ApiError(
            status_code=404,
            code="workout_session_not_found",
            message="Workout session was not found.",
        ) from exc
    except ObjectStorageError as exc:
        raise ApiError(
            status_code=502,
            code="media_storage_unavailable",
            message="Private media storage is unavailable.",
        ) from exc

    try:
        db_session.commit()
        db_session.refresh(progress_photo)
    except Exception:
        db_session.rollback()

        with suppress(ObjectStorageError):
            storage.delete_object(
                key=progress_photo.storage_key,
            )

        raise

    return ProgressPhotoResponse.model_validate(
        progress_photo,
    )


@router.get(
    "/photos",
    response_model=list[ProgressPhotoResponse],
)
def get_progress_photos(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[ProgressPhotoResponse]:
    photos = list_progress_photos(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [ProgressPhotoResponse.model_validate(photo) for photo in photos]


@router.get(
    "/photos/{progress_photo_id}/content",
    response_class=Response,
)
def get_progress_photo_content(
    progress_photo_id: UUID,
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    storage: PrivateObjectStorageDependency,
) -> Response:
    try:
        progress_photo = get_owned_progress_photo(
            db_session=db_session,
            user_id=identity.user.id,
            progress_photo_id=progress_photo_id,
        )
    except ProgressPhotoNotFoundError as exc:
        raise ApiError(
            status_code=404,
            code="progress_photo_not_found",
            message="Progress photo was not found.",
        ) from exc

    try:
        stored_media = storage.get_object(
            key=progress_photo.storage_key,
        )
    except ObjectNotFoundError as exc:
        raise ApiError(
            status_code=404,
            code="progress_photo_content_not_found",
            message="Progress photo content was not found.",
        ) from exc
    except ObjectStorageError as exc:
        raise ApiError(
            status_code=502,
            code="media_storage_unavailable",
            message="Private media storage is unavailable.",
        ) from exc

    return Response(
        content=stored_media.data,
        media_type=stored_media.media_type,
        headers={
            "Cache-Control": "private, no-store",
        },
    )
