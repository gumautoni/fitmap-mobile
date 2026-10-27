from fastapi import APIRouter

from fitmap.api.auth import router as auth_router
from fitmap.api.body_metrics import router as body_metrics_router
from fitmap.api.fitness_goals import router as fitness_goals_router
from fitmap.api.gym_reviews import router as gym_reviews_router
from fitmap.api.gyms import router as gyms_router
from fitmap.api.profile import router as profile_router
from fitmap.api.progress import router as progress_router
from fitmap.api.training import router as training_router
from fitmap.api.training_history import (
    router as training_history_router,
)
from fitmap.api.training_sessions import (
    router as training_sessions_router,
)

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(gyms_router)
api_router.include_router(gym_reviews_router)
api_router.include_router(profile_router)
api_router.include_router(progress_router)
api_router.include_router(body_metrics_router)
api_router.include_router(fitness_goals_router)
api_router.include_router(training_router)
api_router.include_router(training_history_router)
api_router.include_router(training_sessions_router)
