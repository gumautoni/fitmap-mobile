from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from fitmap.progress.goal_models import FitnessGoal
from fitmap.progress.schemas import BodyMetricType, BodyMetricUnit


def create_fitness_goal(
    *,
    db_session: Session,
    user_id: UUID,
    metric_type: BodyMetricType,
    target_value: Decimal,
    unit: BodyMetricUnit,
) -> FitnessGoal:
    goal = FitnessGoal(
        user_id=user_id,
        metric_type=metric_type.value,
        target_value=target_value,
        unit=unit.value,
    )

    db_session.add(goal)
    db_session.flush()

    return goal


def list_fitness_goals(
    *,
    db_session: Session,
    user_id: UUID,
    metric_type: BodyMetricType | None = None,
) -> list[FitnessGoal]:
    statement = select(FitnessGoal).where(
        FitnessGoal.user_id == user_id,
    )

    if metric_type is not None:
        statement = statement.where(
            FitnessGoal.metric_type == metric_type.value,
        )

    statement = statement.order_by(
        FitnessGoal.created_at.desc(),
        FitnessGoal.id.desc(),
    )

    return list(db_session.scalars(statement).all())


def get_owned_fitness_goal(
    *,
    db_session: Session,
    user_id: UUID,
    goal_id: UUID,
) -> FitnessGoal | None:
    statement = select(FitnessGoal).where(
        FitnessGoal.id == goal_id,
        FitnessGoal.user_id == user_id,
    )

    return db_session.scalar(statement)
