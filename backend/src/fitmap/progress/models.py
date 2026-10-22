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
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class ProgressPhoto(Base):
    __tablename__ = "progress_photos"
    __table_args__ = (
        CheckConstraint(
            "length(trim(storage_key)) > 0",
            name="ck_progress_photos_storage_key_not_blank",
        ),
        CheckConstraint(
            "length(trim(media_type)) > 0",
            name="ck_progress_photos_media_type_not_blank",
        ),
        UniqueConstraint(
            "storage_key",
            name="uq_progress_photos_storage_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workout_session_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("workout_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )
    media_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
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


class BodyMetricRecord(Base):
    __tablename__ = "body_metric_records"
    __table_args__ = (
        CheckConstraint(
            ("metric_type IN ('weight', 'waist', 'chest', 'arm', 'thigh', 'hip')"),
            name="ck_body_metric_records_type",
        ),
        CheckConstraint(
            "value > 0",
            name="ck_body_metric_records_value_positive",
        ),
        CheckConstraint(
            (
                "(metric_type = 'weight' AND unit IN ('kg', 'lb')) OR "
                "(metric_type IN ('waist', 'chest', 'arm', 'thigh', 'hip') "
                "AND unit IN ('cm', 'in'))"
            ),
            name="ck_body_metric_records_type_unit",
        ),
        Index(
            "ix_body_metric_records_user_type_recorded_at",
            "user_id",
            "metric_type",
            "recorded_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    metric_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    unit: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
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
