# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API 专用 Dockerfile (Multi-stage Build)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:22-alpine AS builder

# 启用 pnpm
RUN corepack enable

WORKDIR /app

# 复制依赖定义文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖 (仅当 lock 文件变更时才重跑)
# 使用 --frozen-lockfile 确保依赖版本一致
RUN pnpm install --frozen-lockfile

# 复制源代码和配置
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs

# 生成 Prisma Client
RUN pnpm prisma:generate

# 构建应用
RUN pnpm build:admin

# 清理开发依赖，仅保留生产依赖
RUN pnpm prune --prod

# --------------------------------
# Stage 2: Runtime
# --------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    PM2_HOME=/app/.pm2

# 安装 PM2
RUN npm i -g pm2@latest

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 从 Builder 阶段复制依赖 (仅生产依赖)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# 从 Builder 阶段复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/admin-api ./dist

# 复制必要的配置文件
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# 复制 PM2 配置
COPY --chown=nestjs:nodejs ./apps/admin-api/ecosystem.config.cjs ./

# 预创建目录并设置权限
RUN install -d -m 0755 -o nestjs -g nodejs /app/uploads \
 && install -d -m 0755 -o nestjs -g nodejs /app/logs \
 && install -d -m 0755 -o nestjs -g nodejs /app/.pm2 \
 && chown -R nestjs:nodejs /app

RUN apk add --no-cache tzdata
ENV TZ="Asia/Shanghai"

# 切换用户
USER nestjs

EXPOSE 8080

# 启动命令
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed && exec pm2-runtime ecosystem.config.cjs"]
