# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API Dockerfile
# --------------------------------

# --------------------------------
# 阶段 1: 构建器 (Builder)
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 1. 复制配置文件
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json prisma.config.ts ./

# 2. 安装所有依赖
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 3. 复制源代码
COPY libs libs
COPY prisma prisma
COPY apps/admin-api apps/admin-api

# 4. 生成 Prisma 客户端
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
RUN pnpm prisma:generate

# 5. 构建应用
RUN pnpm build:admin

# --------------------------------
# 阶段 2: 运行时 (Runtime)
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

# 安装基础工具
RUN apk add --no-cache dumb-init tzdata

# 启用 pnpm (运行时需要安装依赖)
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 1. 复制依赖配置
COPY pnpm-lock.yaml package.json ./

# 2. 直接在运行时安装生产依赖
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted

# 3. 从 Builder 阶段复制构建产物 (dist)
COPY --from=builder --chown=nestjs:nodejs /app/main.js ./dist/apps/admin-api/main.js

# 创建日志目录
RUN install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["node", "./main.js"]
