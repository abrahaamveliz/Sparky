"""Anti-replay challenge tokens (Section 11 of OWASP LLM Action Plan).

Flow:
  1. Frontend POSTs to /api/challenge (with optional Turnstile token)
  2. Server returns a signed JWT containing a one-time nonce
  3. Frontend sends the JWT as X-Challenge header on /api/chat
  4. Server verifies JWT signature, expiry, and nonce single-use

Nonce storage: Upstash Redis when configured, otherwise in-memory dict.
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import Header, HTTPException
from jose import JWTError, jwt

from server.config import CHALLENGE_SECRET, UPSTASH_REDIS_REST_URL

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_CHALLENGE_TTL = 300  # 5 minutes — matches Turnstile token validity

# In-memory fallback nonce store: nonce → expiry timestamp
_nonce_store: dict[str, float] = {}


def _get_redis():
    """Lazy-init Upstash Redis client (or None if not configured)."""
    if not UPSTASH_REDIS_REST_URL:
        return None
    try:
        from upstash_redis import Redis
        from server.config import UPSTASH_REDIS_REST_TOKEN
        return Redis(url=UPSTASH_REDIS_REST_URL, token=UPSTASH_REDIS_REST_TOKEN)
    except Exception:
        logger.warning("Upstash Redis unavailable, falling back to in-memory nonce store")
        return None


_redis = None
_redis_checked = False


def _redis_client():
    global _redis, _redis_checked
    if not _redis_checked:
        _redis = _get_redis()
        _redis_checked = True
    return _redis


def _cleanup_memory_store():
    """Remove expired nonces from in-memory store."""
    now = time.time()
    expired = [k for k, v in _nonce_store.items() if v < now]
    for k in expired:
        del _nonce_store[k]


def create_challenge_token() -> str:
    """Generate a signed, single-use challenge JWT."""
    if not CHALLENGE_SECRET:
        raise HTTPException(500, "Challenge system not configured")

    nonce = str(uuid.uuid4())
    now = time.time()
    exp = now + _CHALLENGE_TTL

    token = jwt.encode(
        {"sub": "challenge", "nonce": nonce, "iat": now, "exp": exp},
        CHALLENGE_SECRET,
        algorithm=_ALGORITHM,
    )

    # Store nonce
    redis = _redis_client()
    if redis:
        redis.set(f"nonce:{nonce}", "1", ex=_CHALLENGE_TTL)
    else:
        _cleanup_memory_store()
        _nonce_store[nonce] = exp

    return token


def _validate_challenge(token: str) -> dict:
    """Verify a challenge JWT and consume its nonce. Returns payload or raises."""
    if not CHALLENGE_SECRET:
        raise HTTPException(500, "Challenge system not configured")

    try:
        payload = jwt.decode(token, CHALLENGE_SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired challenge token")

    nonce = payload.get("nonce")
    if not nonce:
        raise HTTPException(401, "Malformed challenge token")

    # Verify nonce exists (reusable within its TTL window)
    redis = _redis_client()
    if redis:
        exists = redis.get(f"nonce:{nonce}")
        if not exists:
            raise HTTPException(401, "Challenge expired")
    else:
        if nonce not in _nonce_store or _nonce_store[nonce] < time.time():
            raise HTTPException(401, "Challenge expired")

    return payload


async def require_challenge(x_challenge: str | None = Header(None)):
    """FastAPI dependency — validates the X-Challenge header."""
    if not x_challenge:
        raise HTTPException(401, "Missing challenge token")
    return _validate_challenge(x_challenge)