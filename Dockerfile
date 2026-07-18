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
ARG NPM_REGISTRY=https://registry.npmmirror.com
FROM node:24-alpine AS builder

ARG NPM_REGISTRY
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    COREPACK_NPM_REGISTRY="${NPM_REGISTRY}" \
    NPM_CONFIG_REGISTRY="${NPM_REGISTRY}"

# 启用 pnpm - 使用缓存避免重复执行
RUN --mount=type=cache,target=/root/.cache/corepack \
    corepack enable

WORKDIR /app

# 复制配置文件 - 保持原有优化
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json drizzle.config.ts webpack.config.js ./

# 安装依赖 - 统一缓存ID，提高命中率
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm config set registry "${NPM_REGISTRY}" && \
    pnpm install --frozen-lockfile

# 复制源代码
COPY libs libs
COPY db db

# 参数化应用类型
ARG APP_TYPE=admin
COPY apps/${APP_TYPE}-api apps/${APP_TYPE}-api

# admin-api: 从 controller 装饰器生成 RBAC 权限清单，保证镜像内 manifest 与源码一致
# app-api 跳过（脚本硬编码扫描 apps/admin-api/src，且 app-api 不跑 bootstrap）
RUN if [ "${APP_TYPE}" = "admin" ]; then pnpm db:bootstrap:reference:manifest:write; fi

# 构建应用
RUN pnpm exec cross-env NODE_ENV=production nest build ${APP_TYPE}-api --webpack --webpackPath webpack.config.js

# --------------------------------
# 阶段 2: 生产依赖 (Deps) - 分离缓存层
# --------------------------------
FROM node:24-alpine AS deps

ARG APP_TYPE=admin
ARG NPM_REGISTRY
ENV NODE_ENV=production \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    COREPACK_NPM_REGISTRY="${NPM_REGISTRY}" \
    NPM_CONFIG_REGISTRY="${NPM_REGISTRY}"

WORKDIR /app

# 1. 复制依赖配置
COPY pnpm-lock.yaml package.json ./

# 2. 安装生产依赖 - 独立缓存层
RUN --mount=type=cache,target=/root/.cache/corepack \
    --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    corepack enable && \
    pnpm config set store-dir /pnpm/store && \
    pnpm config set registry "${NPM_REGISTRY}" && \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted && \
    # 清理优化
    ( find node_modules -type f \( \
        -name "*.md" -o -name "*.ts" -o -name "*.map" -o \
        -name "*.test.js" -o -name "*.spec.js" -o -name "*.d.ts" \
    \) -print0 | xargs -0 rm -f ) && \
    ( find node_modules -type d \( -name "test" -o -name "tests" -o -name "@types" \) -exec rm -rf {} + ) && \
    find node_modules -type d -empty -delete

# --------------------------------
# 阶段 3: Node 运行时 (Runtime)
# --------------------------------
FROM node:24-alpine AS runtime

ARG APP_TYPE=admin
# TZ 依赖 Node.js 24 内置 ICU 时区数据，无需安装系统 tzdata
ENV NODE_ENV=production \
    TZ="Asia/Shanghai"

WORKDIR /app

RUN \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    install -d -m 0755 -o nestjs -g nodejs \
        /app/logs \
        /app/secrets \
        /app/uploads \
        /app/uploads/${APP_TYPE}

COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nestjs:nodejs /app/db ./db
COPY --from=builder --chown=nestjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/${APP_TYPE}-api/ ./

EXPOSE 8080

USER nestjs

CMD ["node", "main.js"]
