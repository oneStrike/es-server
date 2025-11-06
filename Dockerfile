# syntax=docker/dockerfile:1.6
# --------------------------------
# 阶段1: 构建阶段
# --------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 使用 Corepack 管理 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 先复制依赖清单以最大化缓存
COPY pnpm-lock.yaml package.json ./

# 使用 BuildKit 缓存加速依赖安装
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 复制 Prisma schema 并缓存引擎下载
RUN  pnpm prisma:generate

# 构建应用
RUN pnpm build

# 只打包生产依赖以减小运行时镜像体积
# 仅保留生产依赖，剔除开发依赖
RUN pnpm prune --prod

# --------------------------------
# 阶段2: 运行时阶段
# --------------------------------
FROM node:22-alpine AS runtime

# 设置环境变量
ENV NODE_ENV=production \
    PORT=8080

# 安装运行时必需的系统依赖（移除 curl，使用 busybox wget）
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制生产依赖和构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nestjs:nodejs /app/logs

# 切换到非root用户
USER nestjs

# 暴露端口
EXPOSE 8080

# 健康检查（使用 busybox wget）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health >/dev/null || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]