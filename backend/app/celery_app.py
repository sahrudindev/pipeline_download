from celery import Celery

from .config import settings

celery = Celery(
    "downloader",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_max_tasks_per_child=20,
    beat_schedule={
        "cleanup-expired-files": {
            "task": "app.tasks.cleanup_task",
            "schedule": 300.0,  # tiap 5 menit
        },
    },
)

# Pastikan task terdaftar.
from . import tasks  # noqa: E402,F401
