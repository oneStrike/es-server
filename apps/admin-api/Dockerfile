# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API Dockerfile
# --------------------------------

# --------------------------------
# 阶段 1: 构建器 (Builder)
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# 1. 复制配置文件 (仅复制依赖相关文件，最大化缓存利用率)
COPY pnpm-lock.yaml package.json ./
COPY nest-cli.json tsconfig*.json prisma.config.ts ./

# 2. 安装所有依赖
RUN pnpm config set store-dir /pnpm/store
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store pnpm install --frozen-lockfile

# 3. 复制源代码和构建配置
COPY libs libs
COPY prisma prisma
COPY apps/admin-api apps/admin-api

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

# 1. 复制依赖配置 (提前复制，以便合并 RUN 指令)
COPY pnpm-lock.yaml package.json ./

# 3. 合并指令：安装系统依赖、初始化环境、安装生产依赖并清理
# 优化：合并为一个 RUN 指令，减少镜像层数，使用独立的缓存ID避免污染
RUN --mount=type=cache,id=pnpm-store-runtime-v1,target=/pnpm/store \
    apk add --no-cache tzdata openssl vim && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin && \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile && \
    # 优化清理策略：更高效地删除无用文件
    find node_modules -type f \( \
        -name "*.md" -o -name "*.ts" -o -name "*.map" -o \
        -name "*.test.js" -o -name "*.spec.js" -o -name "*.d.ts" \
    \) -print0 | xargs -0 rm -f 2>/dev/null || true && \
    # 清理测试目录和类型定义目录
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "@types" \) -exec rm -rf {} + 2>/dev/null || true && \
    # 清理空目录
    find node_modules -type d -empty -delete 2>/dev/null || true

# 4. 复制构建产物 (扁平化复制)
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/admin-api/ ./

EXPOSE 8080

USER nestjs

CMD ["node", "main.js"]
