# ========================================
# 构建阶段 - 安装依赖
# ========================================
FROM node:20-alpine AS dependencies

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

WORKDIR /app

# 复制依赖配置文件
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括 devDependencies，用于构建）
RUN pnpm install --frozen-lockfile

# ========================================
# 构建阶段 - 编译 TypeScript
# ========================================
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9.15.4

WORKDIR /app

# 复制依赖
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
# ========================================
FROM node:20-alpine AS production

# 安装 dumb-init 用于正确处理信号
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 设置 node_modules/.bin 到 PATH
ENV PATH=/app/node_modules/.bin:$PATH

# 复制生产依赖
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# 复制 Prisma schema（运行时需要）
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# 复制 package.json（用于读取版本信息等）
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# 创建日志和上传目录
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nestjs:nodejs /app/logs /app/uploads

# 切换到非 root 用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000

# 使用 dumb-init 启动应用，确保正确处理 SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["node", "dist/main.js"]
