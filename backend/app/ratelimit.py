"""Rate limit sederhana per-IP berbasis Redis (sliding window per menit)."""
from __future__ import annotations

import time

import redis
from fastapi import HTTPException, Request

from .config import settings

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def check_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    window = int(time.time() // 60)
    key = f"rl:{ip}:{window}"
    count = _r.incr(key)
    if count == 1:
        _r.expire(key, 70)
    if count > settings.rate_limit_per_min:
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak permintaan. Maks {settings.rate_limit_per_min}/menit.",
        )
