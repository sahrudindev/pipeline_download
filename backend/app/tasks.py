"""Celery tasks: proses download async + cleanup."""
from __future__ import annotations

import os

from .celery_app import celery
from . import extractor, storage
from .config import settings


@celery.task(name="app.tasks.download_task", bind=True)
def download_task(self, job_id: str, url: str, format_id: str, convert_to: str | None):
    storage.update_job(job_id, status="processing", progress=0.0)

    def on_progress(pct: float, eta):
        storage.update_job(job_id, progress=pct, eta=eta)

    # Folder khusus per-job → pemantauan progress berbasis disk akurat & tak bentrok.
    job_dir = os.path.join(settings.download_dir, job_id)

    try:
        path, filename = extractor.download(
            url=url,
            format_id=format_id,
            convert_to=convert_to,
            out_dir=job_dir,
            on_progress=on_progress,
        )
        storage.update_job(
            job_id,
            status="done",
            progress=100.0,
            eta=0,
            file_path=path,
            filename=filename,
        )
    except Exception as e:  # noqa: BLE001
        storage.update_job(job_id, status="error", error=str(e)[:500])


@celery.task(name="app.tasks.cleanup_task")
def cleanup_task():
    return storage.cleanup_expired()
