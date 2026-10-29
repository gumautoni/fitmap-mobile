"""Provider-independent outbound email contract.

Email contents may contain short-lived secrets (such as recovery codes).
Never log or persist a plaintext serialized message. Only the explicitly
encrypted, expiring transactional outbox may durably store email content.
A real transport must be invoked only after the enclosing transaction commits.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True, repr=False)
class OutboundEmail:
    """A single transactional email, intended for provider delivery."""

    recipient: str
    subject: str
    text_body: str


class EmailTransport(Protocol):
    """Port implemented by a real provider or an isolated test double."""

    def send(self, message: OutboundEmail) -> None: ...
