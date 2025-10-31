# ========================================
# 生产运行时 Dockerfile for NestJS 应用
# 注意：此 Dockerfile 假设构建产物已由 Jenkins 生成
# ========================================

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

# 首先复制 package.json（用于缓存优化）
COPY --chown=nestjs:nodejs ./package.json ./

# 复制生产依赖（这些文件变化频率较低，放在前面利于缓存）
COPY --chown=nestjs:nodejs ./node_modules ./node_modules

# 复制 Prisma 相关文件
COPY --chown=nestjs:nodejs ./prisma ./prisma
COPY --chown=nestjs:nodejs ./prisma.config.ts ./

# 最后复制构建产物（这些文件变化频率最高）
COPY --chown=nestjs:nodejs ./dist ./dist

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
