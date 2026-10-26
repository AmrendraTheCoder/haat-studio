# Haat Studio — production image.
#
#   docker build -t haat-studio .
#   docker run -p 7860:7860 -e HF_TOKEN=hf_... -e STUDIO_PASSCODE=... haat-studio
#
# Port 7860 and user 1000 are what Hugging Face Spaces expect; any other host
# can override PORT. Results live in /data — mount a volume there to keep them.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Preset model photos and sample garments are downloaded, never committed.
RUN npm run build && npm run setup

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7860 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /data && chown node:node /data
# The node image's "node" user is uid 1000, as Hugging Face Spaces require.
USER node
EXPOSE 7860
CMD ["node", "server.js"]
