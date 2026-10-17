from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

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
