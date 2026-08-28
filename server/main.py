"""FastAPI application — serves the chat API and static frontend."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from server.config import HOST, PORT, ALLOWED_ORIGINS
from server.routes.chat import router as chat_router
from server.routes.products import router as products_router
from server.routes.challenge import router as challenge_router

app = FastAPI(title="Sparky", docs_url=None, redoc_url=None)

# CORS — restrict to known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Challenge"],
)


# Security headers middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# API routes
app.include_router(challenge_router)
app.include_router(chat_router)
app.include_router(products_router)

# Serve built frontend (if dist/ exists)
DIST = Path(__file__).parent.parent / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    # SPA fallback — serve index.html for all non-API routes
    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        file = DIST / path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")


def main() -> None:
    import uvicorn
    uvicorn.run(
        "server.main:app",
        host=HOST,
        port=PORT,
        reload=os.environ.get("ENV", "development") == "development",
    )


if __name__ == "__main__":
    main()