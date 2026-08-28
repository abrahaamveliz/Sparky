"""Per-IP rate limiting (Layer 3 of OWASP LLM Action Plan).

Uses Upstash Redis when configured, otherwise a simple in-memory
sliding-window counter. Both implementations use a 60-second window.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from server.config import UPSTASH_REDIS_REST_URL

logger = logging.getLogger(__name__)

MAX_RPM = 20  # requests per minute per IP


class _MemoryRateLimiter:
    """In-memory sliding-window rate limiter (single-process only)."""

    def __init__(self, max_rpm: int = MAX_RPM):
        self.max_rpm = max_rpm
        self.requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> tuple[bool, int]:
        """Returns (allowed, remaining)."""
        now = time.time()
        window = now - 60
        self.requests[key] = [t for t in self.requests[key] if t > window]
        remaining = max(0, self.max_rpm - len(self.requests[key]))
        if len(self.requests[key]) >= self.max_rpm:
            return False, 0
        self.requests[key].append(now)
        return True, remaining - 1


_memory_limiter = _MemoryRateLimiter()

_redis = None
_redis_checked = False


def _redis_client():
    global _redis, _redis_checked
    if not _redis_checked:
        if UPSTASH_REDIS_REST_URL:
            try:
                from upstash_redis import Redis
                from server.config import UPSTASH_REDIS_REST_TOKEN
                _redis = Redis(url=UPSTASH_REDIS_REST_URL, token=UPSTASH_REDIS_REST_TOKEN)
            except Exception:
                logger.warning("Upstash Redis unavailable for rate limiting, using in-memory")
        _redis_checked = True
    return _redis


def _get_client_ip(request: Request) -> str:
    """Extract client IP, preferring X-Forwarded-For behind a trusted proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def check_rate_limit(request: Request) -> None:
    """FastAPI dependency — enforces per-IP rate limiting. Raises 429."""
    client_ip = _get_client_ip(request)
    key = f"ratelimit:ip:{client_ip}"

    redis = _redis_client()
    if redis:
        window = 60
        redis_key = f"{key}:{int(time.time()) // window}"
        count = redis.incr(redis_key)
        if count == 1:
            redis.expire(redis_key, window)
        remaining = max(0, MAX_RPM - count)
        if count > MAX_RPM:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please wait.",
                headers={
                    "X-RateLimit-Limit": str(MAX_RPM),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(window - (int(time.time()) % window)),
                },
            )
    else:
        allowed, remaining = _memory_limiter.check(key)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please wait.",
                headers={
                    "X-RateLimit-Limit": str(MAX_RPM),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "30",
                },
            )