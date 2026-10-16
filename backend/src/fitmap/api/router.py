from fastapi import APIRouter

from fitmap.api.auth import router as auth_router
from fitmap.api.gyms import router as gyms_router
from fitmap.api.profile import router as profile_router
from fitmap.api.training import router as training_router
from fitmap.api.training_sessions import (
    router as training_sessions_router,
)

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(gyms_router)
api_router.include_router(profile_router)
api_router.include_router(training_router)
api_router.include_router(training_sessions_router)
