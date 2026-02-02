# syntax=docker/dockerfile:1.6
# --------------------------------
# App API Dockerfile
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
COPY apps/app-api apps/app-api

# 5. 构建应用
RUN pnpm build:app

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

# 2. 合并指令：安装系统依赖、初始化环境、安装生产依赖并清理
# 优化：合并为一个 RUN 指令，减少镜像层数
# 注意：这会导致当 package.json 变更时，apk add 也会重新运行，但在构建缓存未命中的情况下是值得的
RUN --mount=type=cache,id=pnpm-store-v1,target=/pnpm/store \
    apk add --no-cache dumb-init tzdata openssl && \
    corepack enable && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    install -d -m 0755 -o nestjs -g nodejs \
    /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/app && \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile --config.node-linker=hoisted && \
    # 清理 Markdown、TypeScript 源码、Map 文件、测试文件
    find node_modules -type f \( -name "*.md" -o -name "*.ts" -o -name "*.map" -o -name "*.test.js" -o -name "*.spec.js" \) -delete && \
    # 清理测试目录和类型定义
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "@types" \) -exec rm -rf {} +


# 4. 复制构建产物 (扁平化复制)
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/app-api/ ./

EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs

CMD ["node", "main.js"]
