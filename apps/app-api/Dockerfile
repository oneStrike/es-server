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

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

# 1. 复制 Workspace 配置文件和 Lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# 2. 复制目标应用的 package.json (用于依赖解析)
COPY apps/app-api/package.json apps/app-api/package.json

# 3. 安装所有依赖 (包括 devDependencies，用于构建)
# 使用 --frozen-lockfile 确保版本一致
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-app,target=/pnpm/store pnpm install --frozen-lockfile

# 8. 部署生产依赖 (核心优化步骤)
# 使用 pnpm deploy 导出仅包含生产依赖的独立包
# 这一步会自动剔除 devDependencies 和无关的 hoist 依赖
RUN pnpm --filter=@apps/app-api --prod deploy --legacy /prod/app-api

# 9. 深度清理 node_modules (进一步优化)
WORKDIR /prod/app-api
# 安装 node-prune
RUN wget https://gobinaries.com/tj/node-prune --output-document - | /bin/sh && node-prune

WORKDIR /app

# 4. 复制源代码
COPY . .

# 5. 生成 Prisma Client
# 设置临时的 DATABASE_URL (Prisma 需要它存在才能生成 Client)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm prisma:generate

# 6. 构建应用
RUN pnpm build:app

# 7. 整理部署产物 (Assemble deployment artifacts)
# 将所有运行时需要的文件复制到 /prod/app-api，以便后续一次性复制
RUN cp -r dist /prod/app-api/dist && \
    cp -r prisma /prod/app-api/prisma && \
    cp prisma.config.ts /prod/app-api/prisma.config.ts


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

# 1. 复制生产环境依赖和应用代码 (从 deploy 目录一次性复制)
COPY --from=builder --chown=nestjs:nodejs /prod/app-api ./

# 预创建日志目录
RUN install -d -m 0755 -o nestjs -g nodejs /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/app

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs
CMD ["node", "dist/main.js"]
