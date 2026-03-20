# syntax=docker/dockerfile:1.6

FROM node:24-alpine AS base

RUN --mount=type=cache,target=/root/.cache/corepack \
    corepack enable

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS install

COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts webpack.config.js ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY libs libs
COPY db db

FROM install AS builder

ARG APP_TYPE=admin

COPY apps/${APP_TYPE}-api apps/${APP_TYPE}-api

RUN pnpm exec cross-env NODE_ENV=production nest build ${APP_TYPE}-api --webpack --webpackPath webpack.config.js

FROM install AS runtime-deps

RUN pnpm --filter . deploy --legacy --prod /opt/runtime-deps

FROM base AS migrator

ENV NODE_ENV=production \
    TZ="Asia/Shanghai"

WORKDIR /app

RUN apk add --no-cache dumb-init tzdata && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY --from=install --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=install --chown=nestjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=install --chown=nestjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=install --chown=nestjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=install --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=install --chown=nestjs:nodejs /app/db ./db

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["pnpm", "db:migrate"]

FROM node:24-alpine AS runtime

ARG APP_TYPE=admin

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

WORKDIR /app

RUN apk add --no-cache dumb-init tzdata && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    install -d -m 0755 -o nestjs -g nodejs \
        /app/logs \
        /app/secrets \
        /app/uploads \
        /app/uploads/public \
        /app/uploads/tmp

COPY --from=runtime-deps --chown=nestjs:nodejs /opt/runtime-deps/package.json ./package.json
COPY --from=runtime-deps --chown=nestjs:nodejs /opt/runtime-deps/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/${APP_TYPE}-api/ ./

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["node", "main.js"]
