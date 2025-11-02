# ========================================
# 优化版多阶段构建 Dockerfile
# ========================================

# ========================================
# 构建阶段 - 优化版
# ========================================
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 先复制package文件，利用Docker层缓存
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 安装依赖（这一层会被缓存，除非package.json变化）
RUN pnpm install --frozen-lockfile

# 复制Prisma相关文件（单独层，便于缓存）
COPY ./prisma ./prisma
COPY ./prisma.config.ts ./

# 生成 Prisma 客户端
RUN pnpm prisma:generate

# 最后复制源代码（变化最频繁的文件）
COPY ./src ./src
COPY ./nest-cli.json ./tsconfig*.json

# 构建应用
RUN pnpm run build

# ========================================
# 生产运行时阶段 - 保持不变
# ========================================
FROM node:22-alpine AS production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# 设置工作目录
WORKDIR /app

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads /app/src/prisma && \
    chown -R nestjs:nodejs /app

# 复制 package.json（用于生产依赖安装）
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm@9.15.4

# 只安装生产依赖
RUN pnpm install --prod --frozen-lockfile

# 复制构建产物
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/src/prisma/client ./src/prisma/client
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./

# 设置环境变量
ENV NODE_ENV=production
ENV PATH=/app/node_modules/.bin:$PATH

# 切换用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]