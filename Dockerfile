# --------------------------------
# 阶段1: 构建阶段
# --------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 使用 Corepack 管理 pnpm，避免重复安装
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 复制依赖文件和源代码
COPY pnpm-lock.yaml package*.json ./
COPY . .

# 安装所有依赖（包括开发依赖）
RUN pnpm install --frozen-lockfile

# 生成 Prisma 客户端（输出到 src/prisma/client）
RUN pnpm prisma:generate

# 构建应用
RUN pnpm build

# 清理开发依赖，仅保留生产依赖
RUN pnpm prune --prod

# --------------------------------
# 阶段2: 运行时阶段
# --------------------------------
FROM node:22-alpine AS runtime

# 设置环境变量
ENV NODE_ENV=production \
    PORT=8080

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

# 从构建阶段复制生产依赖和构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R nestjs:nodejs /app/logs

# 切换到非root用户
USER nestjs

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]