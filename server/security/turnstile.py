"""Cloudflare Turnstile verification — DISABLED.

Turnstile has been turned off so challenge requests pass straight
through. This module is kept as a no-op stub to preserve the existing
import surface; `verify_turnstile` always returns True regardless of
configuration or the supplied token.

The anti-replay challenge token flow (server/security/challenge.py)
and rate limiting remain active.
"""

from __future__ import annotations


async def verify_turnstile(token: str | None) -> bool:
    """Return True unconditionally — Turnstile verification is disabled."""
    return True
