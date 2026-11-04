# Builds the web app and serves it together with the API from one Bun process.
# Build context: repository root.
FROM oven/bun:1.4.4-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/scraper/package.json apps/scraper/
COPY packages/contract/package.json packages/contract/
RUN --mount=type=cache,id=nobetcim-bun,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --ignore-scripts

FROM deps AS web-build
ARG VITE_MAPTILER_API_KEY
ENV VITE_MAPTILER_API_KEY=$VITE_MAPTILER_API_KEY
COPY tsconfig.base.json ./
COPY packages/contract packages/contract
COPY apps/web apps/web
RUN bun run --cwd apps/web build

FROM oven/bun:1.4.4-slim AS deps-prod
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/scraper/package.json apps/scraper/
COPY packages/contract/package.json packages/contract/
RUN --mount=type=cache,id=nobetcim-bun,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --production --ignore-scripts --filter @nobetcim/api

FROM oven/bun:1.4.4-slim
WORKDIR /app/apps/api
ENV NODE_ENV=production \
    PORT=1001 \
    WEB_DIST=/app/apps/web/dist \
    MIGRATIONS_DIR=/app/db/migrations
COPY --from=deps-prod /app/node_modules /app/node_modules
COPY --from=deps-prod /app/apps/api/node_modules ./node_modules
COPY packages/contract /app/packages/contract
COPY db/migrations /app/db/migrations
COPY apps/api/package.json apps/api/tsconfig.json ./
COPY apps/api/src ./src
COPY --from=web-build /app/apps/web/dist /app/apps/web/dist
USER bun
EXPOSE 1001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD bun -e "fetch('http://127.0.0.1:1001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "src/index.ts"]
