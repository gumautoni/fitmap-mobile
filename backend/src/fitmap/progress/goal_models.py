from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class FitnessGoal(Base):
    __tablename__ = "fitness_goals"

    __table_args__ = (
        CheckConstraint(
            ("metric_type IN ('weight', 'waist', 'chest', 'arm', 'thigh', 'hip')"),
            name="ck_fitness_goals_metric_type",
        ),
        CheckConstraint(
            "target_value > 0",
            name="ck_fitness_goals_target_value_positive",
        ),
        CheckConstraint(
            (
                "(metric_type = 'weight' AND unit IN ('kg', 'lb')) OR "
                "(metric_type IN ("
                "'waist', 'chest', 'arm', 'thigh', 'hip'"
                ") AND unit IN ('cm', 'in'))"
            ),
            name="ck_fitness_goals_metric_unit",
        ),
        Index(
            "ix_fitness_goals_user_metric_type",
            "user_id",
            "metric_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    metric_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    target_value: Mapped[Decimal] = mapped_column(
        Numeric(
            precision=10,
            scale=2,
        ),
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
