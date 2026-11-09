"""Provider-independent verification email tests; no network calls."""

from datetime import UTC, datetime, timedelta, timezone

import pytest

from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.verification import (
    EmailVerificationAdapter,
    build_email_verification_message,
)

EXPIRES_AT = datetime(2026, 10, 29, 18, 10, tzinfo=UTC)


class FakeTransport:
    def __init__(self) -> None:
        self.messages: list[OutboundEmail] = []

    def send(self, message: OutboundEmail) -> None:
        self.messages.append(message)


def test_email_verification_message_preserves_leading_zeros() -> None:
    message = build_email_verification_message(
        recipient="person@example.com", code="001234", expires_at=EXPIRES_AT
    )
    assert message.recipient == "person@example.com"
    assert message.subject == "FitMap | Confirme seu endereço de e-mail"
    assert "001234" in message.text_body
    assert "29/10/2026 às 18:10 UTC" in message.text_body
    assert "ignore a mensagem" in message.text_body
    assert "Nunca compartilhe" in message.text_body
    assert "001234" not in repr(message)
    assert "person@example.com" not in repr(message)


def test_adapter_sends_message_only_through_injected_transport() -> None:
    fake = FakeTransport()
    sender = EmailVerificationAdapter(fake)
    sender.send_code(recipient="person@example.com", code="000009", expires_at=EXPIRES_AT)
    assert len(fake.messages) == 1
    assert "000009" in fake.messages[0].text_body


@pytest.mark.parametrize(
    "invalid_code",
    ["", "12345", "1234567", "12A456", "12 456", "\uff11\uff12\uff13\uff14\uff15\uff16"],
)
def test_rejects_bad_codes(invalid_code: str) -> None:
    with pytest.raises(ValueError, match="six ASCII digits"):
        build_email_verification_message(
            recipient="person@example.com", code=invalid_code, expires_at=EXPIRES_AT
        )


@pytest.mark.parametrize("recipient", ["", "person@example.com\nBcc:evil@example.com"])
def test_rejects_blank_and_header_injection(recipient: str) -> None:
    with pytest.raises(ValueError, match="Invalid email recipient"):
        build_email_verification_message(recipient=recipient, code="123456", expires_at=EXPIRES_AT)


def test_requires_aware_expiration() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        build_email_verification_message(
            recipient="person@example.com", code="123456", expires_at=datetime(2026, 10, 29)
        )


def test_converts_non_utc_expiration() -> None:
    local = datetime(2026, 10, 29, 15, 10, tzinfo=timezone(-timedelta(hours=3)))
    message = build_email_verification_message(
        recipient="person@example.com", code="123456", expires_at=local
    )
    assert "29/10/2026 às 18:10 UTC" in message.text_body


def test_provider_failure_is_not_swallowed() -> None:
    class FailingTransport:
        def send(self, message: OutboundEmail) -> None:
            raise RuntimeError("provider unavailable")

    with pytest.raises(RuntimeError, match="provider unavailable"):
        EmailVerificationAdapter(FailingTransport()).send_code(
            recipient="person@example.com", code="123456", expires_at=EXPIRES_AT
        )
