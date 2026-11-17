import json
import logging
import subprocess
import sys
from unittest.mock import Mock

import pytest

from fitmap import server
from fitmap.config import Settings


def test_formatter_never_echoes_exception_or_message() -> None:
    try:
        raise RuntimeError("synthetic-private-exception-marker")
    except RuntimeError:
        record = logging.LogRecord(
            name="uvicorn.error",
            level=logging.ERROR,
            pathname="private-source-marker",
            lineno=1,
            msg="private-message-marker %s",
            args=("private-argument-marker",),
            exc_info=sys.exc_info(),
            sinfo="private-stack-marker",
        )

    output = server.SafeOperationalFormatter().format(record)
    event = json.loads(output)

    assert set(event) == {"timestamp", "level", "event"}
    assert event["event"] == "server_error"
    assert event["level"] == "ERROR"
    assert "private-" not in output


@pytest.mark.parametrize(
    ("message", "event_name"),
    [
        (
            "Authentication rate limiter unavailable.",
            "auth_rate_limiter_unavailable",
        ),
        (
            "Unable to clean up uncommitted progress photo.",
            "progress_photo_cleanup_failed",
        ),
        (
            "Application startup complete.",
            "application_started",
        ),
        (
            "unknown-private-message-marker",
            "operational_log",
        ),
    ],
)
def test_formatter_uses_only_known_events(
    message: str,
    event_name: str,
) -> None:
    record = logging.LogRecord(
        "fitmap",
        logging.WARNING,
        "",
        0,
        message,
        (),
        None,
    )

    output = server.SafeOperationalFormatter().format(record)
    assert json.loads(output)["event"] == event_name
    assert "private-" not in output


@pytest.mark.parametrize("level", ["INFO", "ERROR"])
def test_logging_configuration_in_isolated_process(
    level: str,
) -> None:
    code = """
import logging
import logging.config
import sys
from fitmap.server import build_log_config

logging.config.dictConfig(build_log_config(sys.argv[1]))

logging.getLogger("fitmap.http").info('{"event":"http_request"}')
logging.getLogger("uvicorn.access").info("private-access-marker")

try:
    raise RuntimeError("private-traceback-marker")
except RuntimeError:
    logging.getLogger("uvicorn.error").exception(
        "private-server-message-marker"
    )

logging.getLogger("external-library").warning(
    "private-library-message-marker"
)
"""

    result = subprocess.run(
        [sys.executable, "-c", code, level],
        capture_output=True,
        text=True,
        check=True,
    )

    output = result.stdout + result.stderr

    assert "private-" not in output
    assert "Traceback" not in output

    events = [json.loads(line)["event"] for line in result.stdout.splitlines()]

    expected = ["server_error", "operational_log"]

    if level == "INFO":
        expected.insert(0, "http_request")

    assert events == expected


def test_entrypoint_applies_secure_configuration(
    monkeypatch: pytest.MonkeyPatch,
    test_settings: Settings,
) -> None:
    settings = test_settings.model_copy(update={"log_level": "WARNING"})

    run = Mock()

    monkeypatch.setattr(server, "get_settings", lambda: settings)
    monkeypatch.setattr(server.uvicorn, "run", run)

    server.main(
        [
            "--host",
            "127.0.0.1",
            "--port",
            "8123",
            "--reload",
        ]
    )

    run.assert_called_once_with(
        "fitmap.main:app",
        host="127.0.0.1",
        port=8123,
        reload=True,
        access_log=False,
        log_level=None,
        log_config=server.build_log_config("WARNING"),
    )
