import os
from celery import Celery

# Load Redis connection URL from environment or default to localhost
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "egov_tasks",
    broker=redis_url,
    backend=redis_url,
    include=["app.tasks"]
)

# Standard configuration optimizations
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kathmandu",
    enable_utc=True,
)
