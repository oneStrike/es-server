# syntax=docker/dockerfile:1.6
# --------------------------------
# Client API 专用 Dockerfile
# 构建独立的 client-api 服务镜像
# --------------------------------
# --------------------------------
# 阶段1: 构建阶段
# --------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# 使用 Corepack 管理 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 先复制依赖清单以最大化缓存
# 复制根目录的依赖文件（共享依赖）
COPY ../../*.json ./
COPY ../../*-lock.* ./

# 复制 client-api 特定的 package.json
COPY package.json ./

# 使用 BuildKit 缓存加速依赖安装
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile

# 复制源码 - 只复制 client-api 相关的代码
COPY ../../webpack.config.js ./
COPY ../../nest-cli.json ./
COPY ../../tsconfig*.json ./
COPY src ./src
COPY test ./test

# 复制 Prisma schema 并缓存引擎下载
COPY ../../prisma ./prisma
COPY ../../prisma.config.ts ./

# 复制共享模块
COPY ../../src ../src
COPY ../../libs ../libs

# 构建 client-api 应用
RUN pnpm build:client

# 仅保留生产依赖，剔除开发依赖
RUN pnpm prune --prod

# --------------------------------
# 阶段2: 运行时阶段
# --------------------------------
FROM node:22-alpine AS runtime

# 设置环境变量
ENV NODE_ENV=production \
    PORT=8081

# 安装运行时必需的系统依赖（使用 busybox wget）
RUN apk add --no-cache wget

# 安装 PM2 作为 Docker 运行时进程管理（pm2-runtime）
RUN npm i -g pm2@latest

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制生产依赖和构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ../prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nestjs:nodejs /app/ecosystem.config.cjs ./

# 预创建上传目录并授予权限（供命名卷首次挂载继承）
RUN install -d -m 0775 -o nestjs -g nodejs /app/uploads \
 && install -d -m 0775 -o nestjs -g nodejs /app/logs \
 && chown -R nestjs:nodejs /app

# 切换到非root用户
USER nestjs

# 安装并配置 pm2-logrotate 插件（在非root用户下）
RUN pm2 install pm2-logrotate \
 && pm2 set pm2-logrotate:max_size 50M \
 && pm2 set pm2-logrotate:retain 30 \
 && pm2 set pm2-logrotate:compress true \
 && pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss \
 && pm2 set pm2-logrotate:rotateInterval "0 */6 * * *"

# 暴露端口
EXPOSE 8081

# 健康检查（使用 busybox wget）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8081/api/health >/dev/null || exit 1

# 使用 PM2 Runtime 作为容器进程管理器
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema ../prisma/schema.prisma && node_modules/.bin/prisma db seed --schema ../prisma/schema.prisma && exec pm2-runtime ecosystem.config.cjs"]
