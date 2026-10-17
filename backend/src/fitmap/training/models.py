from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) > 0",
            name="ck_exercises_name_not_blank",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    owner_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
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


class Workout(Base):
    __tablename__ = "workouts"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) > 0",
            name="ck_workouts_name_not_blank",
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
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"
    __table_args__ = (
        UniqueConstraint(
            "workout_id",
            "position",
            name="uq_workout_exercises_workout_position",
        ),
        CheckConstraint(
            "position >= 1",
            name="ck_workout_exercises_position_positive",
        ),
        CheckConstraint(
            "target_sets IS NULL OR target_sets >= 1",
            name="ck_workout_exercises_target_sets_positive",
        ),
        CheckConstraint(
            "target_repetitions IS NULL OR target_repetitions >= 1",
            name="ck_workout_exercises_target_repetitions_positive",
        ),
        CheckConstraint(
            "target_load IS NULL OR target_load >= 0",
            name="ck_workout_exercises_target_load_non_negative",
        ),
        CheckConstraint(
            (
                "(target_load IS NULL AND target_load_unit IS NULL) OR "
                "("
                "target_load IS NOT NULL AND "
                "target_load_unit IN ('kg', 'lb')"
                ")"
            ),
            name="ck_workout_exercises_target_load_unit",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    workout_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "workouts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "exercises.id",
            name="workout_exercises_exercise_id_fkey",
            deferrable=True,
            initially="DEFERRED",
        ),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    target_sets: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    target_repetitions: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    target_load: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=8,
            scale=2,
        ),
        nullable=True,
    )
    target_load_unit: Mapped[str | None] = mapped_column(
        String(4),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
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


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    __table_args__ = (
        CheckConstraint(
            "length(trim(workout_name)) > 0",
            name="ck_workout_sessions_workout_name_not_blank",
        ),
        CheckConstraint(
            "status IN ('active', 'completed', 'cancelled')",
            name="ck_workout_sessions_status",
        ),
        CheckConstraint(
            (
                "("
                "status = 'active' AND "
                "completed_at IS NULL AND "
                "cancelled_at IS NULL"
                ") OR ("
                "status = 'completed' AND "
                "completed_at IS NOT NULL AND "
                "cancelled_at IS NULL"
                ") OR ("
                "status = 'cancelled' AND "
                "completed_at IS NULL AND "
                "cancelled_at IS NOT NULL"
                ")"
            ),
            name="ck_workout_sessions_lifecycle_timestamps",
        ),
        Index(
            "uq_workout_sessions_user_active",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
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
    source_workout_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "workouts.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    workout_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="active",
        server_default="active",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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


class ExerciseExecution(Base):
    __tablename__ = "exercise_executions"
    __table_args__ = (
        UniqueConstraint(
            "workout_session_id",
            "position",
            name="uq_exercise_executions_session_position",
        ),
        CheckConstraint(
            "position >= 1",
            name="ck_exercise_executions_position_positive",
        ),
        CheckConstraint(
            "length(trim(exercise_name)) > 0",
            name="ck_exercise_executions_exercise_name_not_blank",
        ),
        CheckConstraint(
            "planned_sets IS NULL OR planned_sets >= 1",
            name="ck_exercise_executions_planned_sets_positive",
        ),
        CheckConstraint(
            "planned_repetitions IS NULL OR planned_repetitions >= 1",
            name="ck_exercise_executions_planned_repetitions_positive",
        ),
        CheckConstraint(
            "planned_load IS NULL OR planned_load >= 0",
            name="ck_exercise_executions_planned_load_non_negative",
        ),
        CheckConstraint(
            (
                "(planned_load IS NULL AND planned_load_unit IS NULL) OR "
                "("
                "planned_load IS NOT NULL AND "
                "planned_load_unit IN ('kg', 'lb')"
                ")"
            ),
            name="ck_exercise_executions_planned_load_unit",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    workout_session_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "workout_sessions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "exercises.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    exercise_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    planned_sets: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    planned_repetitions: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    planned_load: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=8,
            scale=2,
        ),
        nullable=True,
    )
    planned_load_unit: Mapped[str | None] = mapped_column(
        String(4),
        nullable=True,
    )
    planned_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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


class SetExecution(Base):
    __tablename__ = "set_executions"
    __table_args__ = (
        UniqueConstraint(
            "exercise_execution_id",
            "position",
            name="uq_set_executions_exercise_position",
        ),
        CheckConstraint(
            "position >= 1",
            name="ck_set_executions_position_positive",
        ),
        CheckConstraint(
            "repetitions >= 1",
            name="ck_set_executions_repetitions_positive",
        ),
        CheckConstraint(
            "load IS NULL OR load >= 0",
            name="ck_set_executions_load_non_negative",
        ),
        CheckConstraint(
            (
                "(load IS NULL AND load_unit IS NULL) OR "
                "("
                "load IS NOT NULL AND "
                "load_unit IN ('kg', 'lb')"
                ")"
            ),
            name="ck_set_executions_load_unit",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    exercise_execution_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "exercise_executions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    repetitions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    load: Mapped[Decimal | None] = mapped_column(
        Numeric(
            precision=8,
            scale=2,
        ),
        nullable=True,
    )
    load_unit: Mapped[str | None] = mapped_column(
        String(4),
        nullable=True,
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
