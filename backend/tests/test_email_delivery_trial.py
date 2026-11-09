"""Controlled Resend trial: no network or provider credentials are used by tests."""

import json
from dataclasses import asdict
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr

from fitmap.config import Settings
from fitmap.notifications import delivery_trial
from fitmap.notifications.delivery_trial import (
    DeliveryTrialConfigurationError,
    build_trial_preflight,
    send_trial_once,
    validate_trial_settings,
)
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.resend import EmailDeliveryError

_ALLOWED = "tester@example.com"
_SENDER = "security@fitmap.example"
_KEY = "re_fake_controlled_trial_only_123456"


@pytest.fixture
def trial_settings(test_settings: Settings) -> Settings:
    return test_settings.model_copy(
        update={
            "environment": "staging",
            "email_trial_enabled": True,
            "email_trial_recipient": _ALLOWED,
            "email_worker_enabled": False,
            "auth_email_verification_enabled": False,
            "auth_password_recovery_enabled": False,
            "email_provider": "resend",
            "resend_api_key": SecretStr(_KEY),
            "email_from_address": _SENDER,
        }
    )


class FakeTransport:
    def __init__(self, *, fail: bool = False) -> None:
        self.calls: list[tuple[OutboundEmail, str | None]] = []
        self.fail = fail

    def send(self, message: OutboundEmail, *, idempotency_key: str | None = None) -> None:
        self.calls.append((message, idempotency_key))
        if self.fail:
            raise EmailDeliveryError(retryable=True)


def test_default_configuration_is_not_ready(test_settings: Settings) -> None:
    report = build_trial_preflight(test_settings)
    assert not report.configuration_valid
    assert not report.checks["staging_only"]
    assert not report.checks["trial_enabled"]
    assert not report.checks["resend_selected"]
    assert report.manual_verification_required


def test_ready_configuration_still_requires_manual_evidence(trial_settings: Settings) -> None:
    report = build_trial_preflight(trial_settings)
    assert report.configuration_valid
    assert all(report.checks.values())
    assert "resend_domain_verified_for_sending" in report.manual_verification_required
    serialized = json.dumps(asdict(report))
    assert _ALLOWED not in serialized
    assert _SENDER not in serialized
    assert _KEY not in serialized


@pytest.mark.parametrize(
    ("update", "check"),
    [
        ({"environment": "development"}, "staging_only"),
        ({"environment": "production"}, "staging_only"),
        ({"environment": "test"}, "staging_only"),
        ({"email_trial_enabled": False}, "trial_enabled"),
        ({"email_worker_enabled": True}, "worker_disabled"),
        ({"auth_email_verification_enabled": True}, "public_auth_flows_disabled"),
        ({"auth_password_recovery_enabled": True}, "public_auth_flows_disabled"),
        ({"email_provider": "disabled"}, "resend_selected"),
        ({"resend_api_key": None}, "provider_key_format"),
        ({"resend_api_key": SecretStr("short")}, "provider_key_format"),
        ({"email_from_address": None}, "sender_configured"),
        ({"email_from_address": "bad"}, "sender_configured"),
        ({"email_trial_recipient": None}, "test_recipient_configured"),
        ({"email_trial_recipient": "bad"}, "test_recipient_configured"),
        ({"email_timeout_seconds": 16.0}, "provider_timeout_range"),
    ],
)
def test_fail_closed_for_incomplete_configuration(
    trial_settings: Settings, update: dict[str, object], check: str
) -> None:
    settings = trial_settings.model_copy(update=update)
    report = build_trial_preflight(settings)
    assert not report.configuration_valid
    assert not report.checks[check]
    with pytest.raises(DeliveryTrialConfigurationError):
        validate_trial_settings(settings, recipient=_ALLOWED)


@pytest.mark.parametrize(
    "wrong", ["wrong@example.com", "TESTER@example.com", "", "tester@example.com\nBcc:x@y.com"]
)
def test_different_recipient_cannot_send(trial_settings: Settings, wrong: str) -> None:
    with pytest.raises(DeliveryTrialConfigurationError, match="Recipient"):
        validate_trial_settings(trial_settings, recipient=wrong)


def test_exactly_one_message_no_code_and_stable_idempotency(
    monkeypatch: pytest.MonkeyPatch, trial_settings: Settings
) -> None:
    fake = FakeTransport()
    constructed = 0

    def factory(settings: Settings) -> FakeTransport:
        nonlocal constructed
        assert settings is trial_settings
        constructed += 1
        return fake

    monkeypatch.setattr(delivery_trial, "create_resend_transport", factory)
    identifier = UUID("12345678-1234-5678-1234-567812345678")
    send_trial_once(settings=trial_settings, recipient=_ALLOWED, trial_id=identifier)
    assert constructed == 1
    assert len(fake.calls) == 1
    message, key = fake.calls[0]
    assert message.recipient == _ALLOWED
    assert message.subject == "FitMap | Teste controlado de entrega"
    assert key == "fitmap-trial-12345678123456781234567812345678"
    assert "codigo" in message.text_body
    assert "123456" not in message.text_body
    assert "password" not in message.text_body


def test_delivery_error_does_not_trigger_automatic_retry(
    monkeypatch: pytest.MonkeyPatch, trial_settings: Settings
) -> None:
    fake = FakeTransport(fail=True)

    def factory(_settings: Settings) -> FakeTransport:
        return fake

    monkeypatch.setattr(delivery_trial, "create_resend_transport", factory)
    with pytest.raises(EmailDeliveryError):
        send_trial_once(settings=trial_settings, recipient=_ALLOWED, trial_id=uuid4())
    assert len(fake.calls) == 1


def test_validation_occurs_before_constructing_provider(
    monkeypatch: pytest.MonkeyPatch, test_settings: Settings
) -> None:
    def forbidden(_settings: Settings) -> FakeTransport:
        raise AssertionError("Provider constructed despite disabled settings")

    monkeypatch.setattr(delivery_trial, "create_resend_transport", forbidden)
    with pytest.raises(DeliveryTrialConfigurationError):
        send_trial_once(settings=test_settings, recipient=_ALLOWED, trial_id=uuid4())


def test_cli_default_is_offline_and_never_creates_provider(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    trial_settings: Settings,
) -> None:
    monkeypatch.setattr(delivery_trial, "get_settings", lambda: trial_settings)

    def forbidden(_settings: Settings) -> FakeTransport:
        raise AssertionError("Provider used in dry-run mode")

    monkeypatch.setattr(delivery_trial, "create_resend_transport", forbidden)
    assert delivery_trial.main([]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["configuration_valid"] is True
    assert _ALLOWED not in json.dumps(output)


def test_cli_default_disabled_report_without_provider(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    test_settings: Settings,
) -> None:
    monkeypatch.setattr(delivery_trial, "get_settings", lambda: test_settings)
    assert delivery_trial.main([]) == 1
    assert not json.loads(capsys.readouterr().out)["configuration_valid"]


@pytest.mark.parametrize(
    "args",
    [
        ["--send"],
        ["--send", "--confirm-send", "incorrect"],
        ["--to", _ALLOWED],
        ["--trial-id", "12345678-1234-5678-1234-567812345678"],
        ["--confirm-send", "SEND_ONE_TEST_EMAIL"],
        [
            "--send",
            "--to",
            _ALLOWED,
            "--trial-id",
            "invalid",
            "--confirm-send",
            "SEND_ONE_TEST_EMAIL",
        ],
    ],
)
def test_cli_rejects_incomplete_arguments_before_loading_settings(
    monkeypatch: pytest.MonkeyPatch, args: list[str]
) -> None:
    def forbidden() -> Settings:
        raise AssertionError("Settings loaded before validating arguments")

    monkeypatch.setattr(delivery_trial, "get_settings", forbidden)
    assert delivery_trial.main(args) == 2


def test_cli_send_uses_one_transport_call_and_sanitized_summary(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    trial_settings: Settings,
) -> None:
    fake = FakeTransport()
    monkeypatch.setattr(delivery_trial, "get_settings", lambda: trial_settings)

    def factory(_settings: Settings) -> FakeTransport:
        return fake

    monkeypatch.setattr(delivery_trial, "create_resend_transport", factory)
    assert (
        delivery_trial.main(
            [
                "--send",
                "--to",
                _ALLOWED,
                "--trial-id",
                "12345678-1234-5678-1234-567812345678",
                "--confirm-send",
                "SEND_ONE_TEST_EMAIL",
            ]
        )
        == 0
    )
    captured = capsys.readouterr()
    assert json.loads(captured.out) == {
        "provider_accepted": True,
        "inbox_delivery_confirmed": False,
    }
    assert _ALLOWED not in captured.out
    assert _KEY not in captured.out
    assert len(fake.calls) == 1


def test_cli_sanitizes_transport_failure(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    trial_settings: Settings,
) -> None:
    monkeypatch.setattr(delivery_trial, "get_settings", lambda: trial_settings)

    class ExplodingTransport(FakeTransport):
        def send(self, message: OutboundEmail, *, idempotency_key: str | None = None) -> None:
            raise RuntimeError("Sensitive recipient tester@example.com and secret re_private")

    def factory(_settings: Settings) -> ExplodingTransport:
        return ExplodingTransport()

    monkeypatch.setattr(delivery_trial, "create_resend_transport", factory)
    result = delivery_trial.main(
        [
            "--send",
            "--to",
            _ALLOWED,
            "--trial-id",
            str(uuid4()),
            "--confirm-send",
            "SEND_ONE_TEST_EMAIL",
        ]
    )
    captured = capsys.readouterr()
    assert result == 1
    assert "tester@example.com" not in captured.err
    assert "re_private" not in captured.err
    assert "RuntimeError" in captured.err
