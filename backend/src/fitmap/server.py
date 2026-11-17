import argparse
import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime

import uvicorn

from fitmap.config import get_settings

SAFE_EVENTS = {
    "Authentication rate limiter unavailable.": "auth_rate_limiter_unavailable",
    "Progress photo commit outcome uncertain; retaining media.": (
        "progress_photo_commit_uncertain"
    ),
    "Unable to clean up uncommitted progress photo.": ("progress_photo_cleanup_failed"),
    "Started server process [%d]": "server_started",
    "Waiting for application startup.": "application_starting",
    "Application startup complete.": "application_started",
    "Waiting for application shutdown.": "application_stopping",
    "Application shutdown complete.": "application_stopped",
    "Shutting down": "server_stopping",
}


class SafeOperationalFormatter(logging.Formatter):
    """Emit operational events without raw exception or request data."""

    def format(self, record: logging.LogRecord) -> str:
        if record.exc_info:
            event = "server_error" if record.name.startswith("uvicorn") else "operational_error"
        elif isinstance(record.msg, str):
            event = SAFE_EVENTS.get(record.msg, "operational_log")
        else:
            event = "operational_log"

        return json.dumps(
            {
                "timestamp": datetime.fromtimestamp(record.created, UTC)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z"),
                "level": record.levelname,
                "event": event,
            },
            separators=(",", ":"),
        )


def build_log_config(level: str) -> dict[str, object]:
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "http": {"format": "%(message)s"},
            "safe": {
                "()": "fitmap.server.SafeOperationalFormatter",
            },
        },
        "handlers": {
            "http": {
                "class": "logging.StreamHandler",
                "formatter": "http",
                "stream": "ext://sys.stdout",
            },
            "safe": {
                "class": "logging.StreamHandler",
                "formatter": "safe",
                "stream": "ext://sys.stdout",
            },
            "discard": {
                "class": "logging.NullHandler",
            },
        },
        "loggers": {
            "fitmap.http": {
                "handlers": ["http"],
                "level": level,
                "propagate": False,
            },
            "fitmap": {
                "handlers": ["safe"],
                "level": level,
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["safe"],
                "level": level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": [],
                "level": "NOTSET",
                "propagate": True,
            },
            "uvicorn.asgi": {
                "handlers": [],
                "level": "NOTSET",
                "propagate": True,
            },
            "uvicorn.access": {
                "handlers": ["discard"],
                "level": "NOTSET",
                "propagate": False,
            },
        },
        "root": {
            "handlers": ["safe"],
            "level": "WARNING",
        },
    }


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="FitMap API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args(argv)

    settings = get_settings()

    uvicorn.run(
        "fitmap.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        access_log=False,
        log_level=None,
        log_config=build_log_config(settings.log_level),
    )


if __name__ == "__main__":
    main()
