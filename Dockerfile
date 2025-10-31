# ========================================
# 构建阶段 - 安装依赖
FROM node:22-alpine AS dependencies

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

COPY package.json pnpm-lock.yaml ./

# 复制依赖配置文件

# 生成 Prisma Client
# 安装所有依赖（包括 devDependencies，用于构建）
RUN pnpm install --frozen-lockfile
RUN pnpm install --prod --frozen-lockfile

# 构建阶段 - 编译 TypeScript
# 生产运行阶段
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9.15.4

WORKDIR /app
FROM node:20-alpine AS production

COPY --from=dependencies /app/node_modules ./node_modules
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
# 生成 Prisma Client
RUN pnpm prisma:generate
WORKDIR /app

RUN pnpm run build
ENV PATH=/app/node_modules/.bin:$PATH
# 清理开发依赖，仅保留生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制构建产物
# 生产运行阶段

# 复制 Prisma schema（运行时需要）
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init
RUN mkdir -p /app/logs /app/uploads && \
# 创建非 root 用户

    adduser -S nestjs -u 1001
USER nestjs
# 暴露端口
EXPOSE 3000
# 设置 node_modules/.bin 到 PATH
ENV PATH=/app/node_modules/.bin:$PATH

# 使用 dumb-init 启动应用，确保正确处理 SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# 复制构建产物
CMD ["node", "dist/main.js"]

# 复制 Prisma schema（运行时需要）
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./
