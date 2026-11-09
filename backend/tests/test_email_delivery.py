"""Email-delivery foundation: isolated tests with no network or provider secrets."""

from dataclasses import FrozenInstanceError
from datetime import UTC, datetime, timedelta, timezone

import pytest

from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.recovery import RecoveryCodeEmailAdapter, build_recovery_email


class FakeEmailTransport:
    """Test-only in-memory transport. Never imported by application code."""

    def __init__(self) -> None:
        self.messages: list[OutboundEmail] = []

    def send(self, message: OutboundEmail) -> None:
        self.messages.append(message)


EXPIRES_AT = datetime(2026, 10, 29, 18, 10, tzinfo=UTC)


def test_build_recovery_email_is_plain_text_and_preserves_leading_zeros() -> None:
    email = build_recovery_email(email="person@example.com", code="001234", expires_at=EXPIRES_AT)

    assert email.recipient == "person@example.com"
    assert email.subject == "FitMap | Código para redefinir sua senha"
    assert "001234" in email.text_body
    assert "29/10/2026 às 18:10 UTC" in email.text_body
    assert "ignore este e-mail" in email.text_body
    assert "Não compartilhe o código" in email.text_body


def test_adapter_delivers_to_injected_fake_transport() -> None:
    fake = FakeEmailTransport()
    adapter = RecoveryCodeEmailAdapter(fake)

    adapter.send_recovery_code(email="person@example.com", code="000009", expires_at=EXPIRES_AT)

    assert len(fake.messages) == 1
    assert fake.messages[0] == build_recovery_email(
        email="person@example.com", code="000009", expires_at=EXPIRES_AT
    )


@pytest.mark.parametrize(
    "invalid_code",
    ["", "12345", "1234567", "12A456", "\uff11\uff12\uff13\uff14\uff15\uff16", "123 56", "12345\n"],
)
def test_recovery_email_rejects_invalid_codes(invalid_code: str) -> None:
    with pytest.raises(ValueError, match="six ASCII digits"):
        build_recovery_email(email="person@example.com", code=invalid_code, expires_at=EXPIRES_AT)


@pytest.mark.parametrize("email", ["", "person@example.com\nBcc:other@example.com"])
def test_recovery_email_rejects_blank_or_header_injection(email: str) -> None:
    with pytest.raises(ValueError, match="Invalid recipient"):
        build_recovery_email(email=email, code="123456", expires_at=EXPIRES_AT)


def test_recovery_email_requires_timezone_aware_expiration() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        build_recovery_email(
            email="person@example.com",
            code="123456",
            expires_at=datetime(2026, 10, 29, 18, 10),
        )


def test_email_message_repr_does_not_expose_pin_or_recipient() -> None:
    email = build_recovery_email(email="private@example.com", code="876543", expires_at=EXPIRES_AT)
    representation = repr(email)
    assert "876543" not in representation
    assert "private@example.com" not in representation
    assert "text_body" not in representation


def test_email_message_is_immutable() -> None:
    email = build_recovery_email(email="person@example.com", code="000001", expires_at=EXPIRES_AT)
    with pytest.raises(FrozenInstanceError):
        field_name = "text_body"
        setattr(email, field_name, "changed")


def test_adapter_passes_provider_errors_to_caller() -> None:
    class FailingTransport:
        def send(self, message: OutboundEmail) -> None:
            raise RuntimeError("Email transport unavailable")

    adapter = RecoveryCodeEmailAdapter(FailingTransport())
    with pytest.raises(RuntimeError, match="Email transport unavailable"):
        adapter.send_recovery_code(email="person@example.com", code="111111", expires_at=EXPIRES_AT)


def test_utc_conversion_from_another_timezone() -> None:
    local_expiry = datetime(2026, 10, 29, 15, 10, tzinfo=timezone(-timedelta(hours=3)))
    email = build_recovery_email(email="person@example.com", code="123456", expires_at=local_expiry)
    assert "29/10/2026 às 18:10 UTC" in email.text_body
