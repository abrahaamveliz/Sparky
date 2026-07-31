FROM node:24-alpine AS frontend

WORKDIR /app

# Build-time public variables for the Vite client bundle.
ARG VITE_PRODUCT_NAME
ARG VITE_LOGO_URL
ARG VITE_NAV_BAR_ASSET_1
ARG VITE_NAV_BAR_ASSET_2
ARG VITE_NAV_BAR_ASSET_3
ARG VITE_AGENT_AVATAR_URL
ARG VITE_BANNER_1

ENV VITE_PRODUCT_NAME=$VITE_PRODUCT_NAME \
    VITE_LOGO_URL=$VITE_LOGO_URL \
    VITE_NAV_BAR_ASSET_1=$VITE_NAV_BAR_ASSET_1 \
    VITE_NAV_BAR_ASSET_2=$VITE_NAV_BAR_ASSET_2 \
    VITE_NAV_BAR_ASSET_3=$VITE_NAV_BAR_ASSET_3 \
    VITE_AGENT_AVATAR_URL=$VITE_AGENT_AVATAR_URL \
    VITE_BANNER_1=$VITE_BANNER_1

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Python backend ──────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Install Python deps
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code + built frontend
COPY server/ ./server/
COPY --from=frontend /app/dist ./dist

# Runtime config
ARG LLM_BASE_URL
ARG LLM_API_KEY
ARG MODEL_ID
ARG PRODUCT_NAME

ENV LLM_BASE_URL=${LLM_BASE_URL:-https://inference.abrahaamveliz.com} \
    LLM_API_KEY=${LLM_API_KEY} \
    MODEL_ID=${MODEL_ID:-claude-sonnet-4-5} \
    PRODUCT_NAME=${PRODUCT_NAME:-Sparky} \
    PORT=7860 \
    HOST=0.0.0.0

EXPOSE 7860

CMD ["python", "-m", "server.main"]