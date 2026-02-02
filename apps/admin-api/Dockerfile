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
    TZ="Asia/Shanghai" \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /app

# 合并指令：安装系统依赖、启用 pnpm、创建用户、创建目录
RUN apk add --no-cache dumb-init tzdata openssl && \
    corepack enable && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin

# 1. 复制依赖配置
COPY pnpm-lock.yaml package.json ./

# 2. 安装生产依赖并清理
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted && \
    # 清理 Markdown、TypeScript 源码、Map 文件、测试文件
    find node_modules -type f \( -name "*.md" -o -name "*.ts" -o -name "*.map" -o -name "*.test.js" -o -name "*.spec.js" \) -delete && \
    # 清理测试目录和类型定义
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "@types" \) -exec rm -rf {} +

# 3. 复制 Prisma Client
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# 4. 复制构建产物 (扁平化复制：直接将 main.js 和 map 文件复制到 /app)
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/admin-api/ ./

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["node", "main.js"]
