"""add gym favorites

Revision ID: 24f94d668735
Revises: 057bb530b8e1
Create Date: 2026-10-20 15:56:52.855430

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "24f94d668735"
down_revision: str | Sequence[str] | None = "057bb530b8e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gyms",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "address",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "latitude",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "longitude",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            (
                "(latitude IS NULL AND longitude IS NULL) OR "
                "(latitude IS NOT NULL AND longitude IS NOT NULL)"
            ),
            name="ck_gyms_coordinates_complete",
        ),
        sa.CheckConstraint(
            "latitude IS NULL OR (latitude >= -90 AND latitude <= 90)",
            name="ck_gyms_latitude_range",
        ),
        sa.CheckConstraint(
            "length(trim(name)) > 0",
            name="ck_gyms_name_not_blank",
        ),
        sa.CheckConstraint(
            "longitude IS NULL OR (longitude >= -180 AND longitude <= 180)",
            name="ck_gyms_longitude_range",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "favorite_gyms",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "gym_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["gym_id"],
            ["gyms.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "gym_id",
            name="uq_favorite_gyms_user_gym",
        ),
    )
    op.create_index(
        op.f("ix_favorite_gyms_gym_id"),
        "favorite_gyms",
        ["gym_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_favorite_gyms_user_id"),
        "favorite_gyms",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "gym_external_references",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "gym_id",
            sa.Uuid(),
            nullable=False,
        ),
        sa.Column(
            "provider_name",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "external_id",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(trim(external_id)) > 0",
            name="ck_gym_external_references_external_id_not_blank",
        ),
        sa.CheckConstraint(
            "length(trim(provider_name)) > 0",
            name="ck_gym_external_references_provider_not_blank",
        ),
        sa.ForeignKeyConstraint(
            ["gym_id"],
            ["gyms.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "gym_id",
            "provider_name",
            name="uq_gym_external_references_gym_provider",
        ),
        sa.UniqueConstraint(
            "provider_name",
            "external_id",
            name="uq_gym_external_references_provider_external_id",
        ),
    )
    op.create_index(
        op.f("ix_gym_external_references_gym_id"),
        "gym_external_references",
        ["gym_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_gym_external_references_gym_id"),
        table_name="gym_external_references",
    )
    op.drop_table("gym_external_references")

    op.drop_index(
        op.f("ix_favorite_gyms_user_id"),
        table_name="favorite_gyms",
    )
    op.drop_index(
        op.f("ix_favorite_gyms_gym_id"),
        table_name="favorite_gyms",
    )
    op.drop_table("favorite_gyms")

    op.drop_table("gyms")
