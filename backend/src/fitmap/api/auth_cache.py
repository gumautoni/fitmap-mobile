from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class AuthenticationNoStoreMiddleware:
    """Prevent storage of authentication responses by HTTP caches."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        api_prefix: str,
    ) -> None:
        self.app = app
        self.auth_prefix = f"{api_prefix.rstrip('/')}/auth"

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]

        if path != self.auth_prefix and not path.startswith(f"{self.auth_prefix}/"):
            await self.app(scope, receive, send)
            return

        async def send_no_store(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"

            await send(message)

        await self.app(scope, receive, send_no_store)
