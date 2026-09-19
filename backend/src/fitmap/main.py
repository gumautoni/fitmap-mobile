from fastapi import FastAPI

from fitmap.api.router import api_router
from fitmap.api.system import router as system_router
from fitmap.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    application = FastAPI(
        title=app_settings.app_name,
        version="0.1.0",
    )

    application.include_router(system_router)
    application.include_router(
        api_router,
        prefix=app_settings.api_v1_prefix,
    )

    return application


app = create_app()
