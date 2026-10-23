from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fitmap.identity.models import User
from fitmap.progress.goal_models import FitnessGoal
from fitmap.progress.goals import (
    create_fitness_goal,
    list_fitness_goals,
)
from fitmap.progress.schemas import BodyMetricType, BodyMetricUnit


@pytest.fixture
def db_session(
    database_engine: Engine,
) -> Iterator[Session]:
    connection = database_engine.connect()
    transaction = connection.begin()

    session = Session(
        bind=connection,
        expire_on_commit=False,
    )

    try:
        yield session
    finally:
        session.close()

        if transaction.is_active:
            transaction.rollback()

        connection.close()


def create_user(
    db_session: Session,
) -> User:
    user = User(
        name="Fitness Goals Test User",
        email=f"fitness-goals-{uuid4()}@example.com",
        password_hash="test-password-hash",
    )

    db_session.add(user)
    db_session.flush()

    return user


def test_new_user_has_no_fitness_goals(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
    )

    assert goals == []


def test_create_fitness_goal_persists_data(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.50"),
        unit=BodyMetricUnit.KG,
    )

    persisted_goal = db_session.get(
        FitnessGoal,
        goal.id,
    )

    assert persisted_goal is not None
    assert persisted_goal.user_id == user.id
    assert persisted_goal.metric_type == "weight"
    assert persisted_goal.target_value == Decimal("75.50")
    assert persisted_goal.unit == "kg"
    assert persisted_goal.created_at is not None
    assert persisted_goal.updated_at is not None


def test_fitness_goals_are_sorted_newest_first(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    oldest = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("80.00"),
        unit=BodyMetricUnit.KG,
    )

    newest = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.00"),
        unit=BodyMetricUnit.KG,
    )

    oldest.created_at = datetime(2026, 10, 1, tzinfo=UTC)
    newest.created_at = datetime(2026, 10, 21, tzinfo=UTC)

    db_session.flush()

    goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
    )

    assert [goal.id for goal in goals] == [
        newest.id,
        oldest.id,
    ]


def test_fitness_goals_can_be_filtered_by_metric_type(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    weight_goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.00"),
        unit=BodyMetricUnit.KG,
    )

    waist_goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WAIST,
        target_value=Decimal("82.00"),
        unit=BodyMetricUnit.CM,
    )

    weight_goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
    )

    waist_goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WAIST,
    )

    all_goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
    )

    assert [goal.id for goal in weight_goals] == [weight_goal.id]
    assert [goal.id for goal in waist_goals] == [waist_goal.id]
    assert len(all_goals) == 2


def test_fitness_goals_are_isolated_between_users(
    db_session: Session,
) -> None:
    first_user = create_user(db_session)
    second_user = create_user(db_session)

    first_goal = create_fitness_goal(
        db_session=db_session,
        user_id=first_user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.00"),
        unit=BodyMetricUnit.KG,
    )

    second_goal = create_fitness_goal(
        db_session=db_session,
        user_id=second_user.id,
        metric_type=BodyMetricType.WAIST,
        target_value=Decimal("85.00"),
        unit=BodyMetricUnit.CM,
    )

    first_goals = list_fitness_goals(
        db_session=db_session,
        user_id=first_user.id,
    )

    second_goals = list_fitness_goals(
        db_session=db_session,
        user_id=second_user.id,
    )

    assert [goal.id for goal in first_goals] == [first_goal.id]
    assert [goal.id for goal in second_goals] == [second_goal.id]


def test_user_can_create_multiple_goals_for_same_metric(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    first_goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("80.00"),
        unit=BodyMetricUnit.KG,
    )

    second_goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.00"),
        unit=BodyMetricUnit.KG,
    )

    goals = list_fitness_goals(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
    )

    assert len(goals) == 2
    assert {goal.id for goal in goals} == {
        first_goal.id,
        second_goal.id,
    }


@pytest.mark.parametrize(
    ("metric_type", "unit"),
    [
        (BodyMetricType.WEIGHT, BodyMetricUnit.LB),
        (BodyMetricType.WAIST, BodyMetricUnit.IN),
    ],
)
def test_fitness_goal_preserves_original_unit(
    db_session: Session,
    metric_type: BodyMetricType,
    unit: BodyMetricUnit,
) -> None:
    user = create_user(db_session)

    goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=metric_type,
        target_value=Decimal("150.25"),
        unit=unit,
    )

    persisted_goal = db_session.get(
        FitnessGoal,
        goal.id,
    )

    assert persisted_goal is not None
    assert persisted_goal.target_value == Decimal("150.25")
    assert persisted_goal.unit == unit.value


@pytest.mark.parametrize(
    ("metric_type", "unit", "target_value"),
    [
        ("weight", "cm", Decimal("75.00")),
        ("waist", "kg", Decimal("82.00")),
        ("weight", "kg", Decimal("0.00")),
        ("unsupported", "cm", Decimal("50.00")),
    ],
)
def test_database_rejects_invalid_fitness_goals(
    db_session: Session,
    metric_type: str,
    unit: str,
    target_value: Decimal,
) -> None:
    user = create_user(db_session)

    with pytest.raises(IntegrityError), db_session.begin_nested():
        goal = FitnessGoal(
            user_id=user.id,
            metric_type=metric_type,
            target_value=target_value,
            unit=unit,
        )

        db_session.add(goal)
        db_session.flush()

    remaining_goals = db_session.scalars(
        select(FitnessGoal).where(
            FitnessGoal.user_id == user.id,
        )
    ).all()

    assert remaining_goals == []


def test_deleting_user_cascades_to_fitness_goals(
    db_session: Session,
) -> None:
    user = create_user(db_session)

    goal = create_fitness_goal(
        db_session=db_session,
        user_id=user.id,
        metric_type=BodyMetricType.WEIGHT,
        target_value=Decimal("75.00"),
        unit=BodyMetricUnit.KG,
    )

    goal_id = goal.id

    db_session.delete(user)
    db_session.flush()

    remaining_goal = db_session.scalar(
        select(FitnessGoal).where(
            FitnessGoal.id == goal_id,
        )
    )

    assert remaining_goal is None
