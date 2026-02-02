# syntax=docker/dockerfile:1.6
# --------------------------------
# App API Dockerfile (多阶段构建)
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

# 1. 复制 Workspace 配置文件
# 利用 Docker 缓存层优化依赖安装
COPY pnpm-lock.yaml package.json nest-cli.json tsconfig*.json prisma.config.ts ./

# 2. 复制目标应用的 package.json (如果存在)
# 注意：即使不存在也不会报错，COPY 支持通配符或多文件
# COPY apps/app-api/package.json apps/app-api/package.json

# 3. 安装所有依赖 (包括 devDependencies，用于构建)
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 4. 复制源代码
COPY libs libs
COPY prisma prisma
COPY apps/app-api apps/app-api

# 5. 生成 Prisma Client
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
RUN pnpm prisma:generate

# 6. 构建应用
RUN pnpm build:app

# 7. 准备生产环境产物
# 使用 pnpm deploy 提取应用及其生产依赖到隔离目录
# pnpm deploy 会自动处理 workspace 依赖并仅保留 production 依赖
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    pnpm --filter=app-api --prod deploy --legacy /prod/app-api

# 8. 完善生产环境产物
WORKDIR /prod/app-api
# pnpm deploy 不会复制构建产物(dist)和prisma相关文件，需要手动复制
# 注意路径：构建产物在 /app/dist/apps/app-api
RUN cp -r /app/dist ./dist

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

# 从 Builder 阶段复制完整的生产应用
# 包含：package.json, node_modules (prod only), dist, prisma
COPY --from=builder --chown=nestjs:nodejs /prod/app-api ./

# 创建必要的运行时目录并设置权限
RUN install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/app

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

# 启动应用
# 路径说明: pnpm deploy 后的目录结构是扁平的，但 dist 保持了原样
# 假设 build 输出保持了 apps/app-api 结构，则路径为 dist/apps/app-api/main.js
CMD ["node", "dist/apps/app-api/main.js"]
