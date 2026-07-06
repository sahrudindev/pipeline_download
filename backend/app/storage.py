"""State job di Redis + pembersihan file kedaluwarsa."""
from __future__ import annotations

import json
import os
import shutil
import time

import redis

from .config import settings

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def _key(job_id: str) -> str:
    return f"job:{job_id}"


def create_job(job_id: str, url: str, format_id: str) -> None:
    data = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0.0,
        "eta": None,
        "url": url,
        "format_id": format_id,
        "file_path": None,
        "filename": None,
        "error": None,
        "created_at": int(time.time()),
    }
    _r.set(_key(job_id), json.dumps(data), ex=settings.file_ttl_seconds)


def update_job(job_id: str, **fields) -> None:
    raw = _r.get(_key(job_id))
    if not raw:
        return
    data = json.loads(raw)
    data.update(fields)
    ttl = _r.ttl(_key(job_id))
    _r.set(_key(job_id), json.dumps(data), ex=ttl if ttl and ttl > 0 else settings.file_ttl_seconds)


def get_job(job_id: str) -> dict | None:
    raw = _r.get(_key(job_id))
    return json.loads(raw) if raw else None


def cleanup_expired() -> int:
    """Hapus file yang lebih tua dari TTL. Dipanggil periodik oleh worker."""
    removed = 0
    now = time.time()
    d = settings.download_dir
    if not os.path.isdir(d):
        return 0
    for name in os.listdir(d):
        path = os.path.join(d, name)
        try:
            if now - os.path.getmtime(path) <= settings.file_ttl_seconds:
                continue
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
            elif os.path.isfile(path):
                os.remove(path)
                removed += 1
        except OSError:
            pass
    return removed
