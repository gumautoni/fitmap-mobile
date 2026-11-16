from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response

from fitmap.api.dependencies import (
    CurrentIdentityDependency,
    DatabaseSessionDependency,
)
from fitmap.api.errors import ApiError
from fitmap.pagination import (
    DEFAULT_PAGE_LIMIT,
    MAX_PAGE_LIMIT,
    InvalidPaginationCursorError,
)
from fitmap.training.history import (
    list_workout_history,
    list_workout_history_page,
)
from fitmap.training.history_schemas import (
    WorkoutHistoryPageResponse,
    WorkoutHistorySummaryResponse,
)
from fitmap.training.models import WorkoutSession

router = APIRouter(
    prefix="/training",
    tags=["training"],
)


@router.get(
    "/history",
    response_model=list[WorkoutHistorySummaryResponse],
)
def get_workout_history(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
) -> list[WorkoutHistorySummaryResponse]:
    workout_sessions = list_workout_history(
        db_session=db_session,
        user_id=identity.user.id,
    )

    return [
        _build_history_summary_response(workout_session) for workout_session in workout_sessions
    ]


def _parse_history_bound(
    value: str | None,
) -> datetime | None:
    if value is None:
        return None

    try:
        parsed = datetime.fromisoformat(value)

        if parsed.utcoffset() is None:
            raise ValueError("Timezone offset required.")

        return parsed.astimezone(UTC)

    except (ValueError, OverflowError) as exc:
        raise ApiError(
            status_code=422,
            code="request_validation_error",
            message="Request validation failed.",
        ) from exc


@router.get(
    "/history/page",
    response_model=WorkoutHistoryPageResponse,
)
def get_workout_history_page(
    identity: CurrentIdentityDependency,
    db_session: DatabaseSessionDependency,
    response: Response,
    limit: Annotated[
        int,
        Query(ge=1, le=MAX_PAGE_LIMIT),
    ] = DEFAULT_PAGE_LIMIT,
    cursor: Annotated[UUID | None, Query()] = None,
    completed_from: Annotated[
        str | None,
        Query(max_length=64),
    ] = None,
    completed_before: Annotated[
        str | None,
        Query(max_length=64),
    ] = None,
) -> WorkoutHistoryPageResponse:
    start = _parse_history_bound(completed_from)
    end = _parse_history_bound(completed_before)

    if start is not None and end is not None and start >= end:
        raise ApiError(
            status_code=422,
            code="request_validation_error",
            message="Request validation failed.",
        )

    try:
        sessions, next_cursor = list_workout_history_page(
            db_session=db_session,
            user_id=identity.user.id,
            limit=limit,
            cursor=cursor,
            completed_from=start,
            completed_before=end,
        )

    except InvalidPaginationCursorError as exc:
        raise ApiError(
            status_code=422,
            code="invalid_pagination_cursor",
            message="Invalid pagination cursor.",
        ) from exc

    response.headers["Cache-Control"] = "private, no-store"

    return WorkoutHistoryPageResponse(
        items=[_build_history_summary_response(session) for session in sessions],
        next_cursor=next_cursor,
    )


def _build_history_summary_response(
    workout_session: WorkoutSession,
) -> WorkoutHistorySummaryResponse:
    if workout_session.completed_at is None:
        raise RuntimeError("Completed workout session has no completion timestamp.")

    return WorkoutHistorySummaryResponse(
        id=workout_session.id,
        source_workout_id=workout_session.source_workout_id,
        workout_name=workout_session.workout_name,
        notes=workout_session.notes,
        started_at=workout_session.started_at,
        completed_at=workout_session.completed_at,
        created_at=workout_session.created_at,
        updated_at=workout_session.updated_at,
    )
