# syntax=docker/dockerfile:1.6
# --------------------------------
# App API 专用 Dockerfile (基于 Pnpm Workspace 优化)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 1. 复制 Workspace 配置文件 (利用缓存)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nest-cli.json tsconfig*.json prisma.config.ts ./

# 2. 复制目标应用的 package.json (用于依赖解析)
COPY apps/app-api/package.json apps/app-api/package.json

# 3. 安装所有依赖 (包括 devDependencies，用于构建)
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 4. 复制源代码 (仅复制构建所需的目录)
COPY libs libs
COPY prisma prisma
COPY apps/app-api apps/app-api

# 6. 构建应用
RUN pnpm build:app

# 7. 准备生产环境产物
# 使用 pnpm deploy 提取应用及其生产依赖到隔离目录
# 这会自动处理 workspace 依赖并仅保留 production 依赖
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    pnpm --filter=app-api --prod deploy /prod/app-api

# 8. 完善生产环境产物
WORKDIR /prod/app-api
# 复制构建后的代码 (dist)
# 注意: 根据 tsconfig 输出结构，dist/apps/app-api 包含编译后的代码
COPY --from=builder /app/dist/apps/app-api ./dist
# 复制 Prisma Schema 和配置 (用于运行时/生成的 Client)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# --------------------------------
# Stage 2: Runtime
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

# 安装基础工具 (dumb-init 用于信号处理, tzdata 用于时区)
RUN apk add --no-cache dumb-init tzdata

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 从 Builder 阶段复制完整的生产应用 (包含 node_modules, dist, package.json)
COPY --from=builder --chown=nestjs:nodejs /prod/app-api ./

# 创建必要的运行时目录并设置权限
RUN install -d -m 0755 -o nestjs -g nodejs /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/app

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

# 启动应用
# 路径说明: /app/dist 对应 builder 中的 dist/apps/app-api
# 根据 tsconfig 包含 ../../libs 的行为，编译输出通常会包含目录结构
# 这里假设结构为 dist/apps/app-api/src/main.js
CMD ["node", "dist/apps/app-api/apps/app-api/src/main.js"]
