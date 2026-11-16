from datetime import datetime
from uuid import UUID

from sqlalchemy import literal, select, tuple_
from sqlalchemy.orm import Session

from fitmap.pagination import (
    InvalidPaginationCursorError,
    validate_page_limit,
)
from fitmap.training.models import WorkoutSession


def list_workout_history(
    *,
    db_session: Session,
    user_id: UUID,
) -> list[WorkoutSession]:
    statement = (
        select(WorkoutSession)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
        .order_by(
            WorkoutSession.completed_at.desc(),
            WorkoutSession.started_at.desc(),
            WorkoutSession.id.desc(),
        )
    )

    return list(db_session.scalars(statement).all())


def list_workout_history_page(
    *,
    db_session: Session,
    user_id: UUID,
    limit: int,
    cursor: UUID | None = None,
    completed_from: datetime | None = None,
    completed_before: datetime | None = None,
) -> tuple[list[WorkoutSession], UUID | None]:
    validate_page_limit(limit)

    statement = select(WorkoutSession).where(
        WorkoutSession.user_id == user_id,
        WorkoutSession.status == "completed",
        WorkoutSession.completed_at.is_not(None),
    )

    if completed_from is not None:
        statement = statement.where(
            WorkoutSession.completed_at >= completed_from,
        )

    if completed_before is not None:
        statement = statement.where(
            WorkoutSession.completed_at < completed_before,
        )

    if cursor is not None:
        anchor = db_session.scalar(
            statement.where(
                WorkoutSession.id == cursor,
            )
        )

        if anchor is None:
            raise InvalidPaginationCursorError("Invalid pagination cursor.")

        anchor_completed_at = anchor.completed_at

        if anchor_completed_at is None:
            raise InvalidPaginationCursorError("Invalid pagination cursor.")

        statement = statement.where(
            tuple_(
                WorkoutSession.completed_at,
                WorkoutSession.started_at,
                WorkoutSession.id,
            )
            < tuple_(
                literal(anchor_completed_at),
                literal(anchor.started_at),
                literal(anchor.id),
            )
        )

    statement = statement.order_by(
        WorkoutSession.completed_at.desc(),
        WorkoutSession.started_at.desc(),
        WorkoutSession.id.desc(),
    ).limit(limit + 1)

    rows = list(db_session.scalars(statement).all())

    items = rows[:limit]

    next_cursor = items[-1].id if len(rows) > limit else None

    return items, next_cursor
