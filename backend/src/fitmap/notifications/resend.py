"""Opt-in Resend HTTPS transport for transactional emails.

No routes, recovery/verification orchestration, scheduler, or outbox are enabled
by this module. The caller must guarantee durable, idempotent delivery ordering
before using it for security codes. Never log API requests or email bodies.
"""

import json
from typing import cast
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import SecretStr

from fitmap.config import Settings
from fitmap.notifications.email import OutboundEmail

_RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails"


class EmailConfigurationError(RuntimeError):
    """The provider is disabled or missing required server-side settings."""


class EmailDeliveryError(RuntimeError):
    """Sanitized provider failure; never includes tokens, recipients, or email content."""

    def __init__(self, *, retryable: bool) -> None:
        super().__init__("Transactional email delivery failed.")
        self.retryable = retryable


class ResendEmailTransport:
    """HTTPS email transport. A request is sent once; retries belong to an outbox.

    The constructor does not make network requests. It is intentionally not
    instantiated anywhere in the application's current runtime.
    """

    def __init__(self, *, api_key: SecretStr, sender: str, timeout_seconds: float = 5.0) -> None:
        secret = api_key.get_secret_value()
        if len(secret) < 10 or any(char.isspace() for char in secret):
            raise EmailConfigurationError("Invalid Resend API key configuration.")
        if (
            not sender
            or "@" not in sender
            or any(char in sender for char in "\r\n")
            or len(sender) > 320
        ):
            raise EmailConfigurationError("Invalid transactional email sender.")
        if not 1 <= timeout_seconds <= 15:
            raise EmailConfigurationError("Invalid transactional email timeout.")
        self._api_key = api_key
        self._sender = sender
        self._timeout_seconds = timeout_seconds

    def send(self, message: OutboundEmail) -> None:
        """Deliver a message, or raise a sanitized failure with retry classification.

        A successful Resend API response is acceptance, not inbox delivery.
        No automatic retries are made, because an outbox must supply stable
        idempotency keys and track delivery state before retries are safe.
        """
        if (
            not message.recipient
            or not message.subject
            or not message.text_body
            or any(char in message.recipient + message.subject for char in "\r\n")
        ):
            raise ValueError("Invalid transactional email message.")

        payload = json.dumps(
            {
                "from": self._sender,
                "to": [message.recipient],
                "subject": message.subject,
                "text": message.text_body,
            },
            ensure_ascii=False,
        ).encode()
        request = Request(
            _RESEND_EMAIL_ENDPOINT,
            data=payload,
            headers={
                "Authorization": f"Bearer {self._api_key.get_secret_value()}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                status_code = response.status
                result_bytes = response.read()
        except HTTPError as exc:
            raise EmailDeliveryError(retryable=exc.code == 429 or exc.code >= 500) from None
        except (URLError, TimeoutError, OSError):
            # Outcome is uncertain on transport errors; never blind-retry a PIN.
            raise EmailDeliveryError(retryable=True) from None

        if not 200 <= status_code < 300:
            raise EmailDeliveryError(retryable=status_code == 429 or status_code >= 500)

        try:
            result = json.loads(result_bytes)
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise EmailDeliveryError(retryable=True) from None

        if not isinstance(result, dict):
            raise EmailDeliveryError(retryable=True)

        email_id = cast(dict[str, object], result).get("id")

        if not isinstance(email_id, str) or not email_id:
            raise EmailDeliveryError(retryable=True)


def create_resend_transport(settings: Settings) -> ResendEmailTransport:
    """Fail closed until a server explicitly opts in to Resend configuration."""
    if settings.email_provider != "resend":
        raise EmailConfigurationError("Transactional email provider is disabled.")
    if settings.resend_api_key is None or settings.email_from_address is None:
        raise EmailConfigurationError("Transactional email provider is not configured.")
    return ResendEmailTransport(
        api_key=settings.resend_api_key,
        sender=settings.email_from_address,
        timeout_seconds=settings.email_timeout_seconds,
    )
