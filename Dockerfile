# syntax=docker/dockerfile:1

FROM oven/bun:1.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# Commit info is injected at build time (see `bun run docker:build`); kept last for layer caching.
ARG GIT_COMMIT_HASH=""
ARG GIT_COMMIT_MESSAGE=""
ARG GIT_COMMIT_AUTHOR=""
ARG GIT_COMMIT_DATE=""
# Render-only fallback: Render passes RENDER_GIT_COMMIT as a build arg. Remove when leaving Render.
ARG RENDER_GIT_COMMIT=""
ENV GIT_COMMIT_HASH=${GIT_COMMIT_HASH:-$RENDER_GIT_COMMIT} \
    GIT_COMMIT_MESSAGE=$GIT_COMMIT_MESSAGE \
    GIT_COMMIT_AUTHOR=$GIT_COMMIT_AUTHOR \
    GIT_COMMIT_DATE=$GIT_COMMIT_DATE

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT ?? 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "src/server.ts"]
