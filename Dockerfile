# ================================
# 多阶段构建 Dockerfile
# 基于 Alpine Linux 的轻量级镜像
# ================================

# --------------------------------
# 阶段1: 依赖安装阶段
# --------------------------------
FROM node:22-alpine AS dependencies

# 设置工作目录
WORKDIR /app

# 安装 pnpm 和必要的系统依赖
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@9.15.4

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# --------------------------------
# 阶段2: 构建阶段
# --------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm 和构建依赖
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@9.15.4

# 复制依赖文件和源代码
COPY package.json pnpm-lock.yaml ./
COPY . .

# 安装所有依赖（包括开发依赖）
RUN pnpm install --frozen-lockfile

# 生成 Prisma 客户端
RUN pnpm prisma:generate

# 构建应用
RUN pnpm build

# 清理开发依赖，只保留生产依赖
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# --------------------------------
# 阶段3: 运行时阶段
# --------------------------------
FROM node:22-alpine AS runtime

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

# 安装运行时必需的系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制生产依赖
COPY --from=dependencies --chown=nestjs:nodejs /app/node_modules ./node_modules

# 从构建阶段复制构建产物和必要文件
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nestjs:nodejs /app/logs

# 切换到非root用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]