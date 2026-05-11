---
title: Sparky
emoji: 🛒
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
short_description: Walmart Guatemala shopping assistant
---

# Sparky

Walmart Guatemala shopping assistant. Vite/React front-end + a Node API route
(`/api/chat`) that talks to an LLM proxy and the Walmart-GT MCP server.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the secret values
npm run dev                  # boots web (5173) + api (8787) concurrently
```

## Deployment

This repo ships with a `Dockerfile` so it can be deployed to any container
host. On Hugging Face Spaces, set the Space SDK to **Docker** and configure
these secrets in **Settings → Variables and secrets**:

- `LLM_PROXY_URL`, `LLM_PROXY_API_KEY` — the OpenAI-compatible proxy
- `WALMART_MCP_URL`, `WALMART_MCP_API_KEY` — the Walmart-GT MCP server
- `VITE_PRODUCT_NAME`, `PRODUCT_NAME` — branding
- `VITE_LOGO_URL`, `VITE_NAV_BAR_ASSET_1..3`, `VITE_AGENT_AVATAR_URL`,
  `VITE_BANNER_1` — optional brand assets

`VITE_*` values are read at build time; the others are read at runtime.
