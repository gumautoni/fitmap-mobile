"""Compose a transactional email for proof of ownership, without sending it.

No production provider is configured; callers must first durably commit the
verification challenge and must not log the message or verification code.
"""

from datetime import UTC, datetime

from fitmap.notifications.email import EmailTransport, OutboundEmail

_SUBJECT = "FitMap | Confirme seu endereço de e-mail"


def build_email_verification_message(
    *, recipient: str, code: str, expires_at: datetime
) -> OutboundEmail:
    if not recipient or any(character in recipient for character in "\r\n"):
        raise ValueError("Invalid email recipient.")
    if len(code) != 6 or not code.isascii() or not code.isdecimal():
        raise ValueError("Verification code must have six ASCII digits.")
    if expires_at.tzinfo is None or expires_at.utcoffset() is None:
        raise ValueError("Verification expiry must be timezone-aware.")
    expiry = expires_at.astimezone(UTC).strftime("%d/%m/%Y às %H:%M UTC")
    return OutboundEmail(
        recipient=recipient,
        subject=_SUBJECT,
        text_body=(
            "Olá!\n\n"
            "Recebemos uma solicitação para confirmar o e-mail da sua conta FitMap.\n\n"
            f"Código de verificação: {code}\n"
            f"Válido até {expiry}.\n\n"
            "Se você não solicitou essa verificação, ignore a mensagem. "
            "Nunca compartilhe esse código.\n\n"
            "Equipe FitMap\n"
        ),
    )


class EmailVerificationAdapter:
    """Translate domain material to a provider-independent transport."""

    def __init__(self, transport: EmailTransport) -> None:
        self._transport = transport

    def send_code(self, *, recipient: str, code: str, expires_at: datetime) -> None:
        self._transport.send(
            build_email_verification_message(recipient=recipient, code=code, expires_at=expires_at)
        )
