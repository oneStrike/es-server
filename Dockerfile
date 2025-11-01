# ========================================
# 多阶段构建 Dockerfile for NestJS 应用
# ========================================

# ========================================
# 构建阶段
# ========================================
FROM node:22-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码和配置文件
COPY . .

# 生成 Prisma 客户端
RUN pnpm prisma:generate

# 构建应用
RUN pnpm run build

# ========================================
# 生产运行时阶段
# ========================================
FROM node:22-alpine AS production

# 安装 dumb-init 和 curl 用于正确处理信号和健康检查
RUN apk add --no-cache dumb-init curl

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# 设置工作目录
WORKDIR /app

# 创建必要的目录并设置权限
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app

# 复制 package.json 和 pnpm-lock.yaml
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 只安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制 Prisma 相关文件
COPY --chown=nestjs:nodejs ./prisma ./prisma
COPY --chown=nestjs:nodejs ./prisma.config.ts ./

# 从构建阶段复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# 从构建阶段复制生成的 Prisma 客户端
COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# 设置 node_modules/.bin 到 PATH
ENV PATH=/app/node_modules/.bin:$PATH

# 设置环境变量
ENV NODE_ENV=production

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用 dumb-init 启动应用，确保正确处理 SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/main.js"]
