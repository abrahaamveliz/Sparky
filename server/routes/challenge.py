"""POST /api/challenge — anti-replay challenge token endpoint.

Returns a single-use, short-lived JWT that the frontend must send
as the X-Challenge header on subsequent /api/chat requests.
Optionally gated by Cloudflare Turnstile when configured.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Depends

from server.security.challenge import create_challenge_token
from server.security.rate_limit import check_rate_limit
from server.security.turnstile import verify_turnstile

router = APIRouter()


@router.post("/api/challenge")
async def challenge(request: Request, _rl=Depends(check_rate_limit)):
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    turnstile_token = body.get("turnstile") if isinstance(body, dict) else None

    valid = await verify_turnstile(turnstile_token)
    if not valid:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "CAPTCHA verification failed"}, status_code=403)

    token = create_challenge_token()
    return {"challenge": token}