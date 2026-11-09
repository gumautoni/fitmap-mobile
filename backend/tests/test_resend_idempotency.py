"""Resend idempotency: no real HTTP traffic or credentials."""

import json
from typing import Self
from urllib.request import Request

import pytest
from pydantic import SecretStr

from fitmap.notifications.email import OutboundEmail
from fitmap.notifications.resend import ResendEmailTransport


class FakeResponse:
    status = 200

    def __enter__(self) -> Self:
        return self

    def __exit__(self, _kind: object, _exception: object, _traceback: object) -> None:
        return None

    def read(self) -> bytes:
        return b'{"id":"test-resend-id"}'


def test_worker_key_is_in_http_header_and_payload_remains_identical(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[Request] = []

    def fake_urlopen(request: Request, *, timeout: float) -> FakeResponse:
        assert timeout == 5.0
        requests.append(request)
        return FakeResponse()

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    transport = ResendEmailTransport(
        api_key=SecretStr("re_test_only_key_1234567890"), sender="no-reply@fitmap.example"
    )
    message = OutboundEmail("someone@example.com", "Verifique", "Código: 001234")
    transport.send(message, idempotency_key="fitmap-1234_abcd")
    transport.send(message, idempotency_key="fitmap-1234_abcd")
    assert len(requests) == 2
    assert all(req.get_header("Idempotency-key") == "fitmap-1234_abcd" for req in requests)
    assert requests[0].data == requests[1].data
    payload = requests[0].data
    assert isinstance(payload, bytes)
    assert json.loads(payload)["to"] == ["someone@example.com"]


def test_direct_legacy_sends_omit_key(monkeypatch: pytest.MonkeyPatch) -> None:
    requests: list[Request] = []

    def fake_urlopen(request: Request, *, timeout: float) -> FakeResponse:
        requests.append(request)
        return FakeResponse()

    monkeypatch.setattr("fitmap.notifications.resend.urlopen", fake_urlopen)
    transport = ResendEmailTransport(
        api_key=SecretStr("re_test_only_key_1234567890"), sender="no-reply@fitmap.example"
    )
    transport.send(OutboundEmail("someone@example.com", "Subject", "Body"))
    assert requests[0].get_header("Idempotency-key") is None


@pytest.mark.parametrize("key", ["", "a b", "bad\r\nHeader", "x" * 257, "x/y"])
def test_unsafe_idempotency_key_is_rejected_before_network(key: str) -> None:
    transport = ResendEmailTransport(
        api_key=SecretStr("re_test_only_key_1234567890"), sender="no-reply@fitmap.example"
    )
    with pytest.raises(ValueError, match="idempotency"):
        transport.send(OutboundEmail("someone@example.com", "Subject", "Body"), idempotency_key=key)
