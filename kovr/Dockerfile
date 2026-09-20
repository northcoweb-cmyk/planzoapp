# KOVR Sports — production image.
#
# Two stages: the builder installs dev tooling and compiles; the runtime
# carries the compiled output and no toolchain. KOVR has zero runtime
# dependencies, so the final image ships node_modules-free.
#
# No secret is baked in. KOVR_ODDS_API_KEY is read from the environment at
# start time and must be set by the host's secret store, never here.

FROM node:22-alpine AS builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.client.json eslint.config.js ./
COPY src ./src
COPY web ./web
COPY test ./test
COPY scripts ./scripts

# A build that cannot pass its own tests does not become an image.
RUN npm run build && npm test

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    KOVR_IN_CONTAINER=1 \
    KOVR_DB_PATH=/data/kovr.db

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/web ./web
COPY --from=builder /build/src/store/schema.sql ./src/store/schema.sql

# The simulated ledger lives on a volume when the host provides one, and in
# the container otherwise — in which case a restart resets the demo account.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4300)+'/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/index.js"]
