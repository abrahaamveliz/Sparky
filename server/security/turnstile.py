"""Cloudflare Turnstile verification (Section 11.5 of OWASP LLM Action Plan).

Validates the CAPTCHA response token sent by the frontend against
Cloudflare's siteverify endpoint. Skipped when TURNSTILE_SECRET_KEY
is not configured (development mode).
"""

from __future__ import annotations

import logging

import httpx

from server.config import TURNSTILE_SECRET_KEY

logger = logging.getLogger(__name__)

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str | None) -> bool:
    """Verify a Turnstile response token. Returns True if valid or skipped.

    When TURNSTILE_SECRET_KEY is not configured, verification is skipped
    (dev mode). When configured, a valid Turnstile token is required.
    """
    if not TURNSTILE_SECRET_KEY:
        # Turnstile not configured — skip verification (dev mode)
        return True

    if not token:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _VERIFY_URL,
                json={"secret": TURNSTILE_SECRET_KEY, "response": token},
            )
            data = resp.json()
            success = data.get("success", False)
            if not success:
                logger.warning("Turnstile verification failed: %s", data.get("error-codes"))
            return success
    except Exception as e:
        logger.error("Turnstile verification error: %s", e)
        # Fail open in case of network issues — rate limiting still protects
        return True