"""Offline operational audit and safe Resend idempotency error mapping."""

import json
from dataclasses import asdict
from email.message import Message
from io import BytesIO
from urllib.error import HTTPError
from urllib.request import Request

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr

from fitmap.config import Settings
from fitmap.notifications import worker
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.resend import EmailDeliveryError, ResendEmailTransport
from fitmap.notifications.worker import build_delivery_preflight


@pytest.fixture
def staging_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "environment": "staging",
            "email_worker_enabled": True,
            "email_provider": "resend",
            "resend_api_key": SecretStr("re_fake_for_offline_test_only_123456"),
            "email_from_address": "security@fitmap.example",
            "auth_recovery_code_secret": SecretStr("recovery-only-test-secret-123456789012"),
            "auth_email_verification_secret": SecretStr("verification-only-test-secret-1234567890"),
            "auth_rate_limit_secret": SecretStr("limit-only-test-secret-12345678901234"),
            "email_outbox_encryption_key": SecretStr(Fernet.generate_key().decode()),
        }
    )


def test_default_settings_fail_offline_preflight(test_settings: Settings) -> None:
    report = build_delivery_preflight(test_settings)
    assert not report.configuration_valid
    assert not report.checks["worker_enabled"]
    assert not report.checks["approved_environment"]
    assert report.manual_verification_required


def test_staging_configuration_passes_software_checks_but_not_manual_proofs(
    staging_settings: Settings,
) -> None:
    report = build_delivery_preflight(staging_settings)
    assert report.configuration_valid
    assert all(report.checks.values())
    assert "resend_sending_domain_verified" in report.manual_verification_required
    assert "delivery_to_controlled_inbox_confirmed" in report.manual_verification_required
    assert not hasattr(report, "sender")
    assert not hasattr(report, "api_key")


@pytest.mark.parametrize("environment", ["test", "development"])
def test_disallow_non_live_environments(staging_settings: Settings, environment: str) -> None:
    settings = staging_settings.model_copy(update={"environment": environment})
    report = build_delivery_preflight(settings)
    assert not report.configuration_valid
    assert not report.checks["approved_environment"]


@pytest.mark.parametrize(
    ("updates", "check"),
    [
        ({"email_worker_enabled": False}, "worker_enabled"),
        ({"email_provider": "disabled"}, "resend_selected"),
        ({"resend_api_key": None}, "provider_key_format"),
        ({"resend_api_key": SecretStr("short")}, "provider_key_format"),
        ({"resend_api_key": SecretStr("bad whitespace key")}, "provider_key_format"),
        ({"email_from_address": None}, "sender_address_format"),
        ({"email_from_address": "invalid"}, "sender_address_format"),
        ({"email_from_address": "x@y.test\nBcc:bad@z.test"}, "sender_address_format"),
        ({"email_timeout_seconds": 0.0}, "provider_timeout_range"),
        ({"email_timeout_seconds": 16.0}, "provider_timeout_range"),
        ({"auth_recovery_code_secret": None}, "worker_security_secrets"),
        ({"auth_recovery_code_secret": SecretStr("too-short")}, "worker_security_secrets"),
        ({"auth_rate_limit_secret": None}, "http_rate_limit_secret"),
        ({"auth_rate_limit_secret": SecretStr("short")}, "http_rate_limit_secret"),
        ({"email_outbox_encryption_key": SecretStr("not-fernet")}, "worker_security_secrets"),
    ],
)
def test_invalid_configuration_is_reported_without_secret_values(
    staging_settings: Settings, updates: dict[str, object], check: str
) -> None:
    settings = staging_settings.model_copy(update=updates)
    report = build_delivery_preflight(settings)
    assert not report.configuration_valid
    assert not report.checks[check]
    serialized = json.dumps(asdict(report))
    assert "re_fake_for_offline_test_only" not in serialized
    assert "security@fitmap.example" not in serialized
    assert "recovery-only-test-secret" not in serialized


def test_reused_secret_disallowed_in_software_audit(staging_settings: Settings) -> None:
    settings = staging_settings.model_copy(
        update={"auth_recovery_code_secret": staging_settings.auth_email_verification_secret}
    )
    report = build_delivery_preflight(settings)
    assert not report.configuration_valid
    assert not report.checks["worker_security_secrets"]


def test_preflight_cli_has_no_provider_or_database_access(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    staging_settings: Settings,
) -> None:
    monkeypatch.setattr(worker, "get_settings", lambda: staging_settings)

    def forbid() -> None:
        raise AssertionError("Preflight must be entirely offline")

    monkeypatch.setattr(worker, "_open_sessions", forbid)

    def forbid_provider(_settings: Settings) -> None:
        forbid()

    monkeypatch.setattr(worker, "create_resend_transport", forbid_provider)
    assert worker.main(["--preflight"]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["configuration_valid"] is True
    assert "manual_verification_required" in output
    assert "security@" not in json.dumps(output)


def test_preflight_disabled_cli_returns_nonzero_without_db(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    test_settings: Settings,
) -> None:
    monkeypatch.setattr(worker, "get_settings", lambda: test_settings)
    monkeypatch.setattr(
        worker, "_open_sessions", lambda: (_ for _ in ()).throw(AssertionError("DB opened"))
    )
    assert worker.main(["--preflight"]) == 1
    assert json.loads(capsys.readouterr().out)["configuration_valid"] is False


@pytest.mark.parametrize(
    "args",
    [
        ["--preflight", "--execute"],
        ["--preflight", "--execute", "--confirm-send", "SEND_REAL_EMAILS"],
        ["--preflight", "--confirm-send", "SEND_REAL_EMAILS"],
    ],
)
def test_preflight_rejects_send_arguments_before_loading_secrets(
    monkeypatch: pytest.MonkeyPatch, args: list[str]
) -> None:
    monkeypatch.setattr(
        worker, "get_settings", lambda: (_ for _ in ()).throw(AssertionError("Settings loaded"))
    )
    assert worker.main(args) == 2


def _send_with_409(monkeypatch: pytest.MonkeyPatch, body: bytes) -> EmailDeliveryError:
    def fake_urlopen(request: Request, *, timeout: float) -> None:
        assert request.get_method() == "POST"
        assert timeout == 5.0
        raise HTTPError(
            "https://api.resend.com/emails",
            409,
            "do not expose provider details",
            Message(),
            BytesIO(body),
        )

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    transport = ResendEmailTransport(
        api_key=SecretStr("re_fake_for_offline_test_only_123456"),
        sender="security@fitmap.example",
    )
    message = OutboundEmail(
        recipient="person@example.com", subject="Verification", text_body="Secret PIN: 001234"
    )
    with pytest.raises(EmailDeliveryError) as caught:
        transport.send(message, idempotency_key="fitmap-dummy-test")
    assert "person@example.com" not in str(caught.value)
    assert "001234" not in str(caught.value)
    return caught.value


@pytest.mark.parametrize("field", ["name", "error", "code"])
def test_409_mismatched_payload_is_permanent(monkeypatch: pytest.MonkeyPatch, field: str) -> None:
    body = json.dumps({field: "invalid_idempotent_request"}).encode()
    assert not _send_with_409(monkeypatch, body).retryable


@pytest.mark.parametrize("field", ["name", "error", "code"])
def test_409_concurrent_request_is_retryable(monkeypatch: pytest.MonkeyPatch, field: str) -> None:
    body = json.dumps({field: "concurrent_idempotent_requests"}).encode()
    assert _send_with_409(monkeypatch, body).retryable


@pytest.mark.parametrize("body", [b"", b"not-json", b"{}", b"[1, 2, 3]"])
def test_unknown_409_remains_retryable_without_exposing_body(
    monkeypatch: pytest.MonkeyPatch, body: bytes
) -> None:
    assert _send_with_409(monkeypatch, body).retryable
