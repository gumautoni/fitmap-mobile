"""Isolated, opt-in, one-message Resend trial. Never handles recovery codes.

The default command validates local settings without DB, network, or transport
construction. Real delivery requires explicit staging-only configuration and
CLI confirmation; it does not touch the security-code outbox or API flags.
"""

import argparse
import json
import sys
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from uuid import UUID

from fitmap.config import Settings, get_settings
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.resend import create_resend_transport

SEND_CONFIRMATION = "SEND_ONE_TEST_EMAIL"
_SUBJECT = "FitMap | Teste controlado de entrega"
_BODY = (
    "Esta e uma mensagem de teste controlado do FitMap.\n"
    "Ela nao contem codigo de verificacao, senha ou dados de usuario.\n"
    "Nenhuma acao e necessaria.\n"
)
_MANUAL_CHECKS = (
    "resend_domain_verified_for_sending",
    "spf_dkim_and_dmarc_reviewed",
    "sending_only_domain_scoped_api_key",
    "recipient_inbox_owned_and_authorized",
    "resend_event_timeline_and_inbox_checked_after_trial",
)


class DeliveryTrialConfigurationError(RuntimeError):
    """Delivery is denied before any provider access."""


@dataclass(frozen=True, slots=True)
class TrialPreflight:
    configuration_valid: bool
    checks: dict[str, bool]
    manual_verification_required: tuple[str, ...]


def build_trial_preflight(settings: Settings) -> TrialPreflight:
    """Offline checks only; never assert that an external DNS domain is verified."""
    key = settings.resend_api_key
    key_value = key.get_secret_value() if key is not None else ""
    sender = settings.email_from_address or ""
    recipient = settings.email_trial_recipient
    checks = {
        "staging_only": settings.environment == "staging",
        "trial_enabled": settings.email_trial_enabled,
        "worker_disabled": not settings.email_worker_enabled,
        "public_auth_flows_disabled": not (
            settings.auth_email_verification_enabled or settings.auth_password_recovery_enabled
        ),
        "resend_selected": settings.email_provider == "resend",
        "provider_key_format": len(key_value) >= 10
        and not any(character.isspace() for character in key_value),
        "sender_configured": bool(sender)
        and "@" in sender
        and len(sender) <= 320
        and not any(character in sender for character in "\r\n"),
        "test_recipient_configured": recipient is not None
        and bool(str(recipient))
        and "@" in str(recipient)
        and not any(character in str(recipient) for character in "\r\n"),
        "provider_timeout_range": 1 <= settings.email_timeout_seconds <= 15,
    }
    return TrialPreflight(
        configuration_valid=all(checks.values()),
        checks=checks,
        manual_verification_required=_MANUAL_CHECKS,
    )


def validate_trial_settings(settings: Settings, *, recipient: str) -> None:
    """Fail closed for disabled, non-staging or non-allowlisted recipients."""
    report = build_trial_preflight(settings)
    if not report.configuration_valid:
        raise DeliveryTrialConfigurationError("Controlled delivery is disabled or incomplete.")
    allowed = settings.email_trial_recipient
    if allowed is None or recipient != str(allowed):
        raise DeliveryTrialConfigurationError("Recipient is not the configured test inbox.")


def send_trial_once(
    *,
    settings: Settings,
    recipient: str,
    trial_id: UUID,
) -> None:
    """Exactly one Resend request; no automatic retry, DB write, or security PIN."""
    validate_trial_settings(settings, recipient=recipient)
    transport = create_resend_transport(settings)
    transport.send(
        OutboundEmail(recipient=recipient, subject=_SUBJECT, text_body=_BODY),
        idempotency_key=f"fitmap-trial-{trial_id.hex}",
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="FitMap isolated Resend delivery trial")
    parser.add_argument("--send", action="store_true", help="Opt in to one live test message")
    parser.add_argument("--to", help="Must equal the configured test recipient exactly")
    parser.add_argument("--trial-id", help="Fixed UUID for safe Resend idempotency on retry")
    parser.add_argument("--confirm-send", help=f"Required: {SEND_CONFIRMATION}")
    args = parser.parse_args(argv)

    trial_id: UUID | None = None
    if args.send:
        if args.confirm_send != SEND_CONFIRMATION or args.to is None or args.trial_id is None:
            print("Controlled delivery blocked: explicit arguments required.", file=sys.stderr)
            return 2
        try:
            trial_id = UUID(args.trial_id)
        except ValueError:
            print("Controlled delivery blocked: invalid trial identifier.", file=sys.stderr)
            return 2
    elif args.to is not None or args.trial_id is not None or args.confirm_send is not None:
        print("Send-only arguments require --send.", file=sys.stderr)
        return 2

    try:
        settings = get_settings()
        if not args.send:
            report = build_trial_preflight(settings)
            print(json.dumps(asdict(report), sort_keys=True))
            return 0 if report.configuration_valid else 1
        if trial_id is None or args.to is None:
            raise DeliveryTrialConfigurationError("Missing trial parameters.")
        send_trial_once(settings=settings, recipient=args.to, trial_id=trial_id)
        # Accepted by Resend, not confirmation of inbox delivery.
        print(json.dumps({"provider_accepted": True, "inbox_delivery_confirmed": False}))
        return 0
    except Exception as exc:
        # Never echo secrets, recipient, payload, provider body or SQL URL.
        print(f"Controlled delivery blocked or failed ({type(exc).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
