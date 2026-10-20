from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class Gym(Base):
    __tablename__ = "gyms"
    __table_args__ = (
        CheckConstraint(
            "length(trim(name)) > 0",
            name="ck_gyms_name_not_blank",
        ),
        CheckConstraint(
            (
                "(latitude IS NULL AND longitude IS NULL) OR "
                "(latitude IS NOT NULL AND longitude IS NOT NULL)"
            ),
            name="ck_gyms_coordinates_complete",
        ),
        CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="ck_gyms_latitude_range",
        ),
        CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="ck_gyms_longitude_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    longitude: Mapped[float | None] = mapped_column(
        Float,
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


class GymExternalReference(Base):
    __tablename__ = "gym_external_references"
    __table_args__ = (
        CheckConstraint(
            "length(trim(provider_name)) > 0",
            name="ck_gym_external_references_provider_not_blank",
        ),
        CheckConstraint(
            "length(trim(external_id)) > 0",
            name="ck_gym_external_references_external_id_not_blank",
        ),
        UniqueConstraint(
            "provider_name",
            "external_id",
            name="uq_gym_external_references_provider_external_id",
        ),
        UniqueConstraint(
            "gym_id",
            "provider_name",
            name="uq_gym_external_references_gym_provider",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    gym_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "gyms.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    provider_name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    external_id: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class FavoriteGym(Base):
    __tablename__ = "favorite_gyms"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "gym_id",
            name="uq_favorite_gyms_user_gym",
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
