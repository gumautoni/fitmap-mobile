from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class GymReview(Base):
    __tablename__ = "gym_reviews"

    __table_args__ = (
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_gym_reviews_rating_range",
        ),
        CheckConstraint(
            ("comment IS NULL OR length(trim(comment)) BETWEEN 1 AND 1000"),
            name="ck_gym_reviews_comment_length",
        ),
        Index(
            "uq_gym_reviews_active_user_gym",
            "user_id",
            "gym_id",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
        Index(
            "ix_gym_reviews_gym_removed_created",
            "gym_id",
            "removed_at",
            "created_at",
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

    gym_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "gyms.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    rating: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    comment: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    removed_at: Mapped[datetime | None] = mapped_column(
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


class GymReviewReport(Base):
    __tablename__ = "gym_review_reports"

    __table_args__ = (
        UniqueConstraint(
            "review_id",
            "reporter_user_id",
            name="uq_gym_review_reports_review_reporter",
        ),
        CheckConstraint(
            ("reason IN ('spam', 'offensive', 'misleading', 'other')"),
            name="ck_gym_review_reports_reason",
        ),
        CheckConstraint(
            ("details IS NULL OR length(trim(details)) BETWEEN 1 AND 500"),
            name="ck_gym_review_reports_details_length",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    review_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "gym_reviews.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    reporter_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    reason: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )

    details: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
