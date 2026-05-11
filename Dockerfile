FROM node:24-alpine

WORKDIR /app

# Cache deps separately from source for faster rebuilds. We need devDeps at
# build time (tsc, vite) AND at runtime (tsx), so install everything.
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# Bring in the rest of the source and build the Vite client.
# VITE_* secrets configured on the Space are available here as env vars.
COPY . .
RUN npm run build

# HF Spaces serves the container on port 7860 by default.
ENV PORT=7860 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 7860

CMD ["npx", "tsx", "server.ts"]
