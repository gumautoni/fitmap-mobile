"""Email-specific adapter for the internal recovery-code sender contract.

No provider is instantiated here. Do not wire this adapter into a public endpoint
until the recovery challenge is durably committed before outbound delivery.
"""

from datetime import UTC, datetime

from fitmap.notifications.email import EmailTransport, OutboundEmail

_RECOVERY_SUBJECT = "FitMap | Código para redefinir sua senha"


def build_recovery_email(*, email: str, code: str, expires_at: datetime) -> OutboundEmail:
    """Build a plain-text recovery email without introducing external I/O.

    ``expires_at`` must be timezone-aware. The PIN format is intentionally ASCII:
    a Unicode numeric lookalike must never pass as a six-digit recovery code.
    """
    if not email or any(character in email for character in "\r\n"):
        raise ValueError("Invalid recipient email.")
    if len(code) != 6 or not code.isascii() or not code.isdecimal():
        raise ValueError("Recovery code must contain exactly six ASCII digits.")
    if expires_at.tzinfo is None or expires_at.utcoffset() is None:
        raise ValueError("Recovery code expiry must be timezone-aware.")

    expiry = expires_at.astimezone(UTC).strftime("%d/%m/%Y às %H:%M UTC")
    body = (
        "Olá!\n\n"
        "Recebemos uma solicitação para redefinir a senha da sua conta FitMap.\n\n"
        f"Seu código de recuperação: {code}\n"
        f"Validade: até {expiry}.\n\n"
        "Se você não solicitou a redefinição, ignore este e-mail. "
        "Não compartilhe o código com ninguém.\n\n"
        "Equipe FitMap\n"
    )
    return OutboundEmail(recipient=email, subject=_RECOVERY_SUBJECT, text_body=body)


class RecoveryCodeEmailAdapter:
    """Implements the recovery domain's sender port via an injected transport.

    This adapter alone does not provide durable delivery or a production sender.
    The domain currently invokes its sender before transaction commit; do not
    expose it over HTTP until the delivery ordering is redesigned (e.g. outbox).
    """

    def __init__(self, transport: EmailTransport) -> None:
        self._transport = transport

    def send_recovery_code(self, *, email: str, code: str, expires_at: datetime) -> None:
        message = build_recovery_email(email=email, code=code, expires_at=expires_at)
        self._transport.send(message)
