from fastapi import APIRouter

from fitmap.api.gyms import router as gyms_router

api_router = APIRouter()

api_router.include_router(gyms_router)
