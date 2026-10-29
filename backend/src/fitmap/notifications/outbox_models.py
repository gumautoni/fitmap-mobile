"""Encrypted, expiring transactional email outbox; never store plaintext PINs."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class EmailOutboxMessage(Base):
    __tablename__ = "email_outbox_messages"
    __table_args__ = (
        Index("ix_email_outbox_messages_status_expires_at", "status", "expires_at"),
        CheckConstraint(
            "purpose IN ('email_verification', 'password_recovery')",
            name="ck_email_outbox_purpose",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'accepted', 'failed', 'expired')",
            name="ck_email_outbox_status",
        ),
        CheckConstraint("attempt_count >= 0", name="ck_email_outbox_attempt_count"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(String(32), nullable=False)
    # Contains authenticated encryption ciphertext, never plaintext JSON or codes.
    encrypted_payload: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    key_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Stable for the lifetime of this message. Delivery worker MUST reuse it.
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
