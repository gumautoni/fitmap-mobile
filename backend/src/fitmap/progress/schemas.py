from pydantic import BaseModel


class BasicProgressStatisticsResponse(BaseModel):
    completed_workouts: int
    completed_workouts_last_7_days: int
    completed_workouts_last_30_days: int
    training_days_last_30_days: int
    total_performed_sets: int
