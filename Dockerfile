# syntax=docker/dockerfile:1.6
# --------------------------------
# 优化版统一 Dockerfile - 缓存优化
# --------------------------------
# 使用方法:
# docker build --build-arg APP_TYPE=admin -f Dockerfile.optimized -t admin-api .
# docker build --build-arg APP_TYPE=app -f Dockerfile.optimized -t app-api .

# --------------------------------
# 阶段 1: 构建器 (Builder) - 优化缓存
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm - 使用缓存避免重复执行
RUN --mount=type=cache,target=/root/.cache/corepack \
    corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 复制配置文件 - 保持原有优化
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json prisma.config.ts webpack.config.js ./

# 安装依赖 - 统一缓存ID，提高命中率
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# 复制源代码
COPY libs libs
COPY prisma prisma

# 参数化应用类型
ARG APP_TYPE=admin
COPY apps/${APP_TYPE}-api apps/${APP_TYPE}-api

# 构建应用
RUN pnpm exec cross-env NODE_ENV=production nest build ${APP_TYPE}-api --webpack --webpackPath webpack.config.js

# --------------------------------
# 阶段 2: 生产依赖 (Deps) - 分离缓存层
# --------------------------------
FROM node:24-alpine AS deps

ARG APP_TYPE=admin
ENV NODE_ENV=production \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /app

# 1. 复制依赖配置
COPY pnpm-lock.yaml package.json ./

# 2. 安装生产依赖 - 独立缓存层
RUN --mount=type=cache,target=/root/.cache/corepack \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    corepack enable && \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted && \
    # 清理优化
    find node_modules -type f \( \
        -name "*.md" -o -name "*.ts" -o -name "*.map" -o \
        -name "*.test.js" -o -name "*.spec.js" -o -name "*.d.ts" \
    \) -print0 | xargs -0 rm -f 2>/dev/null || true && \
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "@types" \) -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type d -empty -delete 2>/dev/null || true

# --------------------------------
# 阶段 3: Bun 运行时 (Runtime)
# --------------------------------
FROM oven/bun:alpine AS runtime

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
        /app/uploads/${APP_TYPE}

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/${APP_TYPE}-api/ ./

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["bun", "main.js"]
