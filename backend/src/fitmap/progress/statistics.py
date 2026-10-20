from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fitmap.training.models import (
    ExerciseExecution,
    SetExecution,
    WorkoutSession,
)


@dataclass(frozen=True, slots=True)
class BasicProgressStatistics:
    completed_workouts: int
    completed_workouts_last_7_days: int
    completed_workouts_last_30_days: int
    training_days_last_30_days: int
    total_performed_sets: int


def get_basic_progress_statistics(
    *,
    db_session: Session,
    user_id: UUID,
) -> BasicProgressStatistics:
    reference_time = datetime.now(UTC)
    last_7_days = reference_time - timedelta(days=7)
    last_30_days = reference_time - timedelta(days=30)

    completed_workouts = _count_completed_workouts(
        db_session=db_session,
        user_id=user_id,
    )

    completed_workouts_last_7_days = _count_completed_workouts(
        db_session=db_session,
        user_id=user_id,
        completed_since=last_7_days,
    )

    completed_workouts_last_30_days = _count_completed_workouts(
        db_session=db_session,
        user_id=user_id,
        completed_since=last_30_days,
    )

    training_days_last_30_days = _count_training_days(
        db_session=db_session,
        user_id=user_id,
        completed_since=last_30_days,
    )

    total_performed_sets = _count_performed_sets(
        db_session=db_session,
        user_id=user_id,
    )

    return BasicProgressStatistics(
        completed_workouts=completed_workouts,
        completed_workouts_last_7_days=completed_workouts_last_7_days,
        completed_workouts_last_30_days=completed_workouts_last_30_days,
        training_days_last_30_days=training_days_last_30_days,
        total_performed_sets=total_performed_sets,
    )


def _count_completed_workouts(
    *,
    db_session: Session,
    user_id: UUID,
    completed_since: datetime | None = None,
) -> int:
    statement = (
        select(func.count())
        .select_from(WorkoutSession)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
    )

    if completed_since is not None:
        statement = statement.where(
            WorkoutSession.completed_at >= completed_since,
        )

    value = db_session.scalar(statement)

    return int(value or 0)


def _count_training_days(
    *,
    db_session: Session,
    user_id: UUID,
    completed_since: datetime,
) -> int:
    statement = (
        select(
            func.count(
                func.distinct(
                    func.date(WorkoutSession.completed_at),
                )
            )
        )
        .select_from(WorkoutSession)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
            WorkoutSession.completed_at >= completed_since,
        )
    )

    value = db_session.scalar(statement)

    return int(value or 0)


def _count_performed_sets(
    *,
    db_session: Session,
    user_id: UUID,
) -> int:
    statement = (
        select(func.count())
        .select_from(SetExecution)
        .join(
            ExerciseExecution,
            SetExecution.exercise_execution_id == ExerciseExecution.id,
        )
        .join(
            WorkoutSession,
            ExerciseExecution.workout_session_id == WorkoutSession.id,
        )
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status == "completed",
        )
    )

    value = db_session.scalar(statement)

    return int(value or 0)
