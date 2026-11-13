from fastapi import FastAPI

from fitmap.api.auth_cache import AuthenticationNoStoreMiddleware
from fitmap.api.errors import register_exception_handlers
from fitmap.api.router import api_router
from fitmap.api.system import router as system_router
from fitmap.config import Settings, get_settings
from fitmap.identity.accounts import initialize_authentication_password_hash


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    initialize_authentication_password_hash()

    application = FastAPI(
        title=app_settings.app_name,
        version="0.1.0",
    )
    application.state.settings = app_settings

    application.add_middleware(
        AuthenticationNoStoreMiddleware,
        api_prefix=app_settings.api_v1_prefix,
    )

    register_exception_handlers(application)

    application.include_router(system_router)
    application.include_router(
        api_router,
        prefix=app_settings.api_v1_prefix,
    )

    return application


app = create_app()
