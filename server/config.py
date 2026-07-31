"""Central configuration — reads from environment once at import time."""

from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local", override=True)
load_dotenv()  # .env fallback, no override

# Inference endpoint (Anthropic-compatible)
LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
MODEL_ID: str = os.environ.get("MODEL_ID", "claude-sonnet-4-5")

# VTEX / Walmart Guatemala
WALMART_BASE: str = "https://www.walmart.com.gt"

# Server
HOST: str = os.environ.get("HOST", "0.0.0.0")
PORT: int = int(os.environ.get("PORT", "8000"))