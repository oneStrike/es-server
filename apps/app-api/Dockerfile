# syntax=docker/dockerfile:1.6
# --------------------------------
# App API 专用 Dockerfile (Multi-stage Build)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable

WORKDIR /app

# 复制依赖定义文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖 (包括 devDependencies 以便构建)
RUN pnpm install --frozen-lockfile

# 复制源代码和配置
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs

# 设置临时的 DATABASE_URL 用于构建阶段
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# 生成 Prisma Client
RUN pnpm prisma:generate

# 构建应用
RUN pnpm build:app

# --------------------------------
# Stage 2: Pruner (清理依赖)
# --------------------------------
FROM node:24-alpine AS pruner

RUN corepack enable
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/libs/base/src/database/prisma-client ./libs/base/src/database/prisma-client

# 仅安装生产依赖
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# 深度清理 node_modules
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune

# 删除未使用的 Prisma 引擎（如果存在）
RUN find node_modules -name "libquery_engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete || true

# --------------------------------
# Stage 3: Runtime
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080

# 安装 dumb-init 作为 PID 1
RUN apk add --no-cache dumb-init tzdata
ENV TZ="Asia/Shanghai"

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 从 Pruner 阶段复制清理后的生产依赖
COPY --from=pruner --chown=nestjs:nodejs /app/node_modules ./node_modules

# 从 Builder 阶段复制构建产物 (dist)
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/app-api ./dist

# 从 Builder 阶段复制 Prisma Client 生成物
# 关键: 如果 prisma client 生成在 libs 下，必须手动复制，否则运行时找不到 client
COPY --from=builder --chown=nestjs:nodejs /app/libs/base/src/database/prisma-client ./libs/base/src/database/prisma-client

# 复制必要的配置和 Prisma Schema (用于 migrate deploy)
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# 预创建目录并设置权限
RUN install -d -m 0755 -o nestjs -g nodejs /app/uploads \
 && install -d -m 0755 -o nestjs -g nodejs /app/logs \
 && chown -R nestjs:nodejs /app

# 切换用户
USER nestjs

EXPOSE 8080

# 启动命令
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
