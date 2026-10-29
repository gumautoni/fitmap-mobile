"""Resend transport contract tests: entirely offline; no real credentials or network."""

import json
from email.message import Message
from typing import Self
from urllib.error import HTTPError, URLError
from urllib.request import Request

import pytest
from pydantic import SecretStr

from fitmap.config import Settings
from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.resend import (
    EmailConfigurationError,
    EmailDeliveryError,
    ResendEmailTransport,
    create_resend_transport,
)

_TEST_KEY = "re_test_only_key_not_real_12345"
_SENDER = "no-reply@fitmap.example"
_MESSAGE = OutboundEmail(
    recipient="person@example.com",
    subject="Verifique sua conta",
    text_body="Seu código: 001234",
)


class FakeResponse:
    def __init__(self, *, status: int = 200, body: bytes = b'{"id":"email-test-id"}') -> None:
        self.status = status
        self._body = body

    def __enter__(self) -> Self:
        return self

    def __exit__(self, _exc_type: object, _exc: object, _tb: object) -> None:
        return None

    def read(self) -> bytes:
        return self._body


def transport() -> ResendEmailTransport:
    return ResendEmailTransport(api_key=SecretStr(_TEST_KEY), sender=_SENDER)


def test_default_configuration_disables_email_provider(test_settings: Settings) -> None:
    assert test_settings.email_provider == "disabled"
    with pytest.raises(EmailConfigurationError, match="disabled"):
        create_resend_transport(test_settings)


def test_resend_requires_explicit_server_configuration(test_settings: Settings) -> None:
    enabled = test_settings.model_copy(update={"email_provider": "resend"})
    with pytest.raises(EmailConfigurationError, match="not configured"):
        create_resend_transport(enabled)


def test_configured_factory_is_lazy_and_does_not_expose_api_key(
    test_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbidden_urlopen(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Network should not be accessed while creating a transport")

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", forbidden_urlopen)
    enabled = test_settings.model_copy(
        update={
            "email_provider": "resend",
            "resend_api_key": SecretStr(_TEST_KEY),
            "email_from_address": _SENDER,
        }
    )
    sender = create_resend_transport(enabled)
    assert isinstance(sender, ResendEmailTransport)
    assert _TEST_KEY not in repr(sender)


@pytest.mark.parametrize("secret", ["", "short", "has whitespace", "abc\n1234567890"])
def test_rejects_bad_api_keys(secret: str) -> None:
    with pytest.raises(EmailConfigurationError, match="API key"):
        ResendEmailTransport(api_key=SecretStr(secret), sender=_SENDER)


@pytest.mark.parametrize(
    "sender", ["", "not-an-address", "person@example.com\nBcc:bad@example.com"]
)
def test_rejects_invalid_sender(sender: str) -> None:
    with pytest.raises(EmailConfigurationError, match="sender"):
        ResendEmailTransport(api_key=SecretStr(_TEST_KEY), sender=sender)


@pytest.mark.parametrize("timeout", [0.0, -1.0, 30.0])
def test_rejects_unsafe_timeout(timeout: float) -> None:
    with pytest.raises(EmailConfigurationError, match="timeout"):
        ResendEmailTransport(api_key=SecretStr(_TEST_KEY), sender=_SENDER, timeout_seconds=timeout)


def test_sends_minimal_https_request_to_resend_without_real_network(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[tuple[Request, float]] = []

    def fake_urlopen(request: Request, *, timeout: float) -> FakeResponse:
        captured.append((request, timeout))
        return FakeResponse()

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    transport().send(_MESSAGE)
    assert len(captured) == 1
    request, timeout = captured[0]
    assert request.full_url == "https://api.resend.com/emails"
    assert request.get_method() == "POST"
    assert timeout == 5.0
    assert request.get_header("Authorization") == f"Bearer {_TEST_KEY}"
    assert request.get_header("Content-type") == "application/json"
    payload = request.data
    assert isinstance(payload, bytes)
    assert json.loads(payload) == {
        "from": _SENDER,
        "to": ["person@example.com"],
        "subject": "Verifique sua conta",
        "text": "Seu código: 001234",
    }


@pytest.mark.parametrize(
    ("code", "retryable"),
    [(400, False), (401, False), (403, False), (422, False), (429, True), (500, True), (503, True)],
)
def test_http_error_mapping_never_leaks_secrets(
    code: int, retryable: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_urlopen(_request: Request, *, timeout: float) -> FakeResponse:
        raise HTTPError(
            "https://api.resend.com/emails",
            code,
            "private details must not escape",
            Message(),
            None,
        )

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    with pytest.raises(EmailDeliveryError) as error:
        transport().send(_MESSAGE)
    assert error.value.retryable is retryable
    assert _TEST_KEY not in str(error.value)
    assert "001234" not in str(error.value)
    assert "private details" not in str(error.value)


@pytest.mark.parametrize("cause", [URLError("private network detail"), TimeoutError("timed out")])
def test_network_errors_have_generic_message(
    cause: Exception, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_urlopen(_request: Request, *, timeout: float) -> FakeResponse:
        raise cause

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    with pytest.raises(EmailDeliveryError) as error:
        transport().send(_MESSAGE)
    assert error.value.retryable is True
    assert "private network detail" not in str(error.value)


@pytest.mark.parametrize("body", [b"not json", b"{}", b'{"id":""}', b'{"id":3}'])
def test_invalid_success_body_is_not_accepted(body: bytes, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(_request: Request, *, timeout: float) -> FakeResponse:
        return FakeResponse(body=body)

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    with pytest.raises(EmailDeliveryError) as error:
        transport().send(_MESSAGE)
    assert error.value.retryable is True


@pytest.mark.parametrize("status", [202, 204, 429, 503])
def test_http_status_handling_without_http_error(
    status: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_urlopen(_request: Request, *, timeout: float) -> FakeResponse:
        return FakeResponse(status=status)

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    if status in (202, 204):
        transport().send(_MESSAGE)
    else:
        with pytest.raises(EmailDeliveryError) as error:
            transport().send(_MESSAGE)
        assert error.value.retryable is True


@pytest.mark.parametrize(
    "message",
    [
        OutboundEmail(
            recipient="bad@example.com\nBcc:admin@example.com", subject="Hello", text_body="X"
        ),
        OutboundEmail(
            recipient="person@example.com", subject="Hey\nBcc:admin@example.com", text_body="X"
        ),
        OutboundEmail(recipient="", subject="Hello", text_body="X"),
        OutboundEmail(recipient="person@example.com", subject="", text_body="X"),
        OutboundEmail(recipient="person@example.com", subject="Hello", text_body=""),
    ],
)
def test_invalid_message_rejected_before_network(
    message: OutboundEmail, monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbidden_urlopen(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Invalid message should never go over network")

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", forbidden_urlopen)
    with pytest.raises(ValueError, match="Invalid transactional"):
        transport().send(message)
