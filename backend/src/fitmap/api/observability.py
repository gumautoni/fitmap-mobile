import json
import logging
from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.routing import Route
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-ID"

logger = logging.getLogger("fitmap.http")

HTTP_METHODS = frozenset(
    {
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "CONNECT",
        "TRACE",
    }
)


def _route_template(scope: Scope, api_prefix: str) -> str:
    # FastAPI may retain the original APIRoute without
    # the prefix supplied by include_router().
    route = scope.get("route")

    if not isinstance(route, Route):
        return "unmatched"

    path = scope["path"]
    root_path = scope.get("root_path", "")

    if root_path and (path == root_path or path.startswith(f"{root_path}/")):
        path = path[len(root_path) :]

    # Raw paths are used only for matching, never for logging.
    if route.path_regex.fullmatch(path):
        return route.path

    if api_prefix and (path == api_prefix or path.startswith(f"{api_prefix}/")):
        relative_path = path[len(api_prefix) :]

        if route.path_regex.fullmatch(relative_path):
            return f"{api_prefix}{route.path}"

    return "unmatched"


def _http_method(scope: Scope) -> str:
    method = scope.get("method")

    if isinstance(method, str) and method in HTTP_METHODS:
        return method

    return "OTHER"


def _log_request(
    *,
    scope: Scope,
    api_prefix: str,
    request_id: str,
    started_at: float,
    status_code: int,
    failed: bool = False,
) -> None:
    level = logging.ERROR if failed or status_code >= 500 else logging.INFO

    event = {
        "timestamp": datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "level": logging.getLevelName(level),
        "event": "http_request",
        "request_id": request_id,
        "method": _http_method(scope),
        "route": _route_template(scope, api_prefix),
        "status_code": status_code,
        "duration_ms": round((perf_counter() - started_at) * 1000, 3),
    }

    logger.log(level, json.dumps(event, separators=(",", ":")))


class RequestObservabilityMiddleware:
    """Record privacy-preserving HTTP request events."""

    def __init__(self, app: ASGIApp, *, api_prefix: str) -> None:
        self.app = app
        self.api_prefix = api_prefix.rstrip("/")

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid4().hex
        started_at = perf_counter()
        status_code = 500

        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code

            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers[REQUEST_ID_HEADER] = request_id

            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            _log_request(
                scope=scope,
                api_prefix=self.api_prefix,
                request_id=request_id,
                started_at=started_at,
                status_code=status_code,
                failed=True,
            )
            raise
        else:
            _log_request(
                scope=scope,
                api_prefix=self.api_prefix,
                request_id=request_id,
                started_at=started_at,
                status_code=status_code,
            )
