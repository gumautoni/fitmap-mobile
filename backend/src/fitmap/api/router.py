from fastapi import APIRouter

from fitmap.api.auth import router as auth_router
from fitmap.api.gyms import router as gyms_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(gyms_router)
