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
# 阶段 2: 生产依赖 (Prod Deps)
# --------------------------------
FROM node:24-alpine AS prod-deps

RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 1. 复制配置文件
COPY pnpm-lock.yaml package.json ./

# 2. 仅安装生产依赖
# 使用 hoisted 模式避免符号链接问题，以便可以直接复制 node_modules
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted

# --------------------------------
# 阶段 3: 运行时 (Runtime)
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

# 安装基础工具
# 移除 pnpm 和构建工具，保持镜像精简
RUN apk add --no-cache dumb-init tzdata openssl

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 1. 从 Prod Deps 阶段复制 node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

# 2. 从 Builder 阶段复制生成的 Prisma Client
# 必须覆盖可能存在的旧 client，确保包含生成的代码
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# 3. 从 Builder 阶段复制构建产物 (dist)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# 创建日志目录
RUN install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["node", "dist/apps/admin-api/main.js"]
