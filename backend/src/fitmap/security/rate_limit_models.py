"""Opaque, account-independent counters for security-sensitive API actions."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from fitmap.persistence.base import Base


class AuthRateLimitBucket(Base):
    __tablename__ = "auth_rate_limit_buckets"
    __table_args__ = (
        CheckConstraint("request_count >= 1", name="ck_auth_rate_limit_count_positive"),
    )

    # HMAC-SHA256 only. Never persist IP addresses, emails or user identifiers here.
    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
