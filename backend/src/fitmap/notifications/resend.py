"""Opt-in Resend HTTPS transport; delivery orchestration lives in the outbox dispatcher.

Never log API requests, headers, recipients or messages containing short-lived codes.
"""

import json
import re
from typing import cast
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import SecretStr

from fitmap.config import Settings
from fitmap.notifications.email import OutboundEmail

_RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails"
_IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{1,256}$")


class EmailConfigurationError(RuntimeError):
    """The provider is disabled or missing required server-side settings."""


class EmailDeliveryError(RuntimeError):
    """Sanitized provider failure; never includes tokens, recipients, or email content."""

    def __init__(self, *, retryable: bool) -> None:
        super().__init__("Transactional email delivery failed.")
        self.retryable = retryable


class ResendEmailTransport:
    """HTTPS transport, no automatic retries and no network access during initialization."""

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

    def send(self, message: OutboundEmail, *, idempotency_key: str | None = None) -> None:
        """One submission only. The worker must reuse the same idempotency key on retries.

        2xx with a nonempty identifier means accepted by Resend, not inbox delivered.
        Existing direct send callers remain compatible with an omitted idempotency key.
        """
        if (
            not message.recipient
            or not message.subject
            or not message.text_body
            or any(char in message.recipient + message.subject for char in "\r\n")
        ):
            raise ValueError("Invalid transactional email message.")
        if idempotency_key is not None and not _IDEMPOTENCY_KEY_RE.fullmatch(idempotency_key):
            raise ValueError("Invalid email idempotency key.")

        payload = json.dumps(
            {
                "from": self._sender,
                "to": [message.recipient],
                "subject": message.subject,
                "text": message.text_body,
            },
            ensure_ascii=False,
        ).encode()
        headers = {
            "Authorization": f"Bearer {self._api_key.get_secret_value()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key
        request = Request(
            _RESEND_EMAIL_ENDPOINT,
            data=payload,
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout_seconds) as response:
                status_code = response.status
                result_bytes = response.read()
        except HTTPError as exc:
            # 409 may indicate a concurrent request with the same key. Retrying the
            # unchanged payload/key within the short PIN lifetime is safe.
            raise EmailDeliveryError(retryable=exc.code in (409, 429) or exc.code >= 500) from None
        except (URLError, TimeoutError, OSError):
            raise EmailDeliveryError(retryable=True) from None

        if not 200 <= status_code < 300:
            raise EmailDeliveryError(retryable=status_code in (409, 429) or status_code >= 500)

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
    """Fail closed until the server explicitly opts in to Resend configuration."""
    if settings.email_provider != "resend":
        raise EmailConfigurationError("Transactional email provider is disabled.")
    if settings.resend_api_key is None or settings.email_from_address is None:
        raise EmailConfigurationError("Transactional email provider is not configured.")
    return ResendEmailTransport(
        api_key=settings.resend_api_key,
        sender=settings.email_from_address,
        timeout_seconds=settings.email_timeout_seconds,
    )
