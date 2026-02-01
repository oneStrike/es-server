# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API 专用 Dockerfile (基于 Pnpm Workspace 优化)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

# 1. 复制 Workspace 配置文件 (利用缓存)
COPY . .

# 3. 安装所有依赖
# 使用 --frozen-lockfile 确保版本一致
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 5. 生成 Prisma Client
# 设置临时的 DATABASE_URL (Prisma 需要它存在才能生成 Client)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma:generate

# 6. 构建应用
RUN pnpm build:admin

# 7. 部署生产依赖 (核心优化步骤)
# 使用 pnpm deploy 导出仅包含生产依赖的独立包
RUN pnpm --filter=@apps/admin-api --prod deploy --legacy /prod/admin-api

# 8. 深度清理 node_modules
WORKDIR /prod/admin-api
# 安装 node-prune
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune

# 9. 整理部署产物
WORKDIR /app
# 将构建产物复制到部署目录
# 注意: 由于 monorepo 编译结构，main.js 路径可能较深，这里保留原结构
RUN cp -r dist /prod/admin-api/dist && \
    cp -r prisma /prod/admin-api/prisma && \
    cp prisma.config.ts /prod/admin-api/prisma.config.ts

# --------------------------------
# Stage 2: Runtime
# --------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"

RUN apk add --no-cache dumb-init tzdata

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 1. 复制生产环境依赖和应用代码
COPY --from=builder --chown=nestjs:nodejs /prod/admin-api ./

# 预创建日志目录
RUN install -d -m 0755 -o nestjs -g nodejs /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

# 注意: 根据 tsconfig 编译输出，main.js 可能位于深层目录
CMD ["node", "dist/apps/admin-api/apps/admin-api/src/main.js"]
