FROM node:24-alpine

WORKDIR /app

# Build-time public variables. On Hugging Face Spaces these are passed via
# --build-arg when configured as "Variables" on the Space. They're picked up
# by Vite (import.meta.env.VITE_*) and baked into the client bundle. Without
# the ARG/ENV plumbing, HF only injects them at runtime — too late for the
# client build, so things like the product name fall back to their defaults.
ARG PRODUCT_NAME
ARG VITE_PRODUCT_NAME
ARG VITE_LOGO_URL
ARG VITE_NAV_BAR_ASSET_1
ARG VITE_NAV_BAR_ASSET_2
ARG VITE_NAV_BAR_ASSET_3
ARG VITE_AGENT_AVATAR_URL
ARG VITE_BANNER_1

ENV PRODUCT_NAME=$PRODUCT_NAME \
    VITE_PRODUCT_NAME=$VITE_PRODUCT_NAME \
    VITE_LOGO_URL=$VITE_LOGO_URL \
    VITE_NAV_BAR_ASSET_1=$VITE_NAV_BAR_ASSET_1 \
    VITE_NAV_BAR_ASSET_2=$VITE_NAV_BAR_ASSET_2 \
    VITE_NAV_BAR_ASSET_3=$VITE_NAV_BAR_ASSET_3 \
    VITE_AGENT_AVATAR_URL=$VITE_AGENT_AVATAR_URL \
    VITE_BANNER_1=$VITE_BANNER_1

# Cache deps separately from source for faster rebuilds. We need devDeps at
# build time (tsc, vite) AND at runtime (tsx), so install everything.
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Bring in the rest of the source and build the Vite client.
COPY . .
RUN npm run build

# HF Spaces serves the container on port 7860 by default.
ENV PORT=7860 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 7860

CMD ["npx", "tsx", "server.ts"]
