# ========================================
# 多阶段构建 Dockerfile for NestJS 应用
# ========================================

# 依赖安装阶段
FROM node:22-alpine AS dependencies

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 devDependencies，用于构建）
RUN pnpm install --frozen-lockfile

# ========================================
# 构建阶段 - 编译 TypeScript
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 从依赖阶段复制 node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# 复制源代码和配置文件
COPY . .

# 生成 Prisma Client
RUN pnpm prisma:generate

# 构建应用
RUN pnpm run build

# 清理开发依赖，仅保留生产依赖
RUN pnpm install --prod --frozen-lockfile

# ========================================
# 生产运行阶段
FROM node:22-alpine AS production

# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# 设置工作目录
WORKDIR /app

# 创建必要的目录并设置权限
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app

# 从构建阶段复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# 设置 node_modules/.bin 到 PATH
ENV PATH=/app/node_modules/.bin:$PATH

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 使用 dumb-init 启动应用，确保正确处理 SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]
