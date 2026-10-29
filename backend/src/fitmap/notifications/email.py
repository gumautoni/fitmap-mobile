"""Provider-independent outbound email contract.

Email contents can contain short-lived secrets (such as recovery codes). Never log
or persist a serialized message. A real transport will be implemented separately.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True, repr=False)
class OutboundEmail:
    """A single transactional email, intended for immediate provider delivery."""

    recipient: str
    subject: str
    text_body: str


class EmailTransport(Protocol):
    """Port implemented by a future real provider or an isolated test double."""

    def send(self, message: OutboundEmail) -> None: ...
