# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API 专用 Dockerfile (基于 Pnpm Workspace 优化)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable

WORKDIR /app

# 1. 复制 Workspace 配置文件和 Lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# 2. 复制目标应用的 package.json (用于依赖解析)
COPY apps/admin-api/package.json apps/admin-api/package.json

# 3. 安装所有依赖 (包括 devDependencies，用于构建)
# 使用 --frozen-lockfile 确保版本一致
RUN pnpm install --frozen-lockfile

# 4. 复制源代码
COPY . .

# 5. 生成 Prisma Client
# 设置临时的 DATABASE_URL (Prisma 需要它存在才能生成 Client)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma:generate

# 6. 构建应用
RUN pnpm build:admin

# 7. 清理 Source Map (减小体积)
RUN find dist -name "*.js.map" -type f -delete

# 8. 部署生产依赖 (核心优化步骤)
# 使用 pnpm deploy 导出仅包含生产依赖的独立包
# 这一步会自动剔除 devDependencies 和无关的 hoist 依赖
RUN pnpm --filter=@apps/admin-api --prod deploy --legacy /prod/admin-api

# 9. 深度清理 node_modules (进一步优化)
WORKDIR /prod/admin-api
# 安装 node-prune
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune
# 删除可能残留的 Prisma 引擎 (保留 musl 版本)
RUN find node_modules -name "libquery_engine-*" -not -name "*linux-musl-openssl-3.0.x*" -delete || true

# --------------------------------
# Stage 2: Runtime
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 1. 复制生产环境依赖 (从 deploy 目录)
COPY --from=builder --chown=nestjs:nodejs /prod/admin-api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /prod/admin-api/package.json ./package.json

# 2. 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/admin-api ./dist/apps/admin-api

# 3. 复制 Prisma Client 生成文件 (包括二进制引擎)
# 确保运行时能找到 Query Engine
COPY --from=builder --chown=nestjs:nodejs /app/libs/base/src/database/prisma-client ./libs/base/src/database/prisma-client

# 预创建日志目录
RUN install -d -m 0755 -o nestjs -g nodejs /app/logs

# 切换用户
USER nestjs

EXPOSE 8080

# 直接启动，不再使用 PM2 以节省体积
CMD ["node", "dist/apps/admin-api/main.js"]
