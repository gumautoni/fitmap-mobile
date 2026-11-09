"""Merge authentication and exercise catalog migration branches.

Revision ID: c32e5a8b7f91
Revises: 31c7e2a9f4b0, e94a7f6c21d8

This revision joins two existing migration histories.
Schema and data changes remain in their original revisions.
"""

from collections.abc import Sequence

revision: str = "c32e5a8b7f91"

down_revision: str | Sequence[str] | None = (
    "31c7e2a9f4b0",
    "e94a7f6c21d8",
)

branch_labels: str | Sequence[str] | None = None

depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Join the migration histories without additional operations."""
    pass


def downgrade() -> None:
    """Separate the migration histories without additional operations."""
    pass
