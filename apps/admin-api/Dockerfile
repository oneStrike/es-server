# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API 专用 Dockerfile
# 构建独立的 admin-api 服务镜像
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
COPY ./*.json ./
COPY ./*-lock.* ./

# 使用 BuildKit 缓存加速依赖安装
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile

COPY . .

# 构建 admin-api 应用
RUN pnpm build:admin

# 仅保留生产依赖，剔除开发依赖
RUN pnpm prune --prod

# --------------------------------
# 阶段2: 运行时阶段
# --------------------------------
FROM node:22-alpine AS runtime

# 设置环境变量
ENV NODE_ENV=production \
    PORT=8080 \
    PM2_HOME=/app/.pm2

# 安装 PM2 作为 Docker 运行时进程管理（pm2-runtime）
RUN npm i -g pm2@latest

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制生产依赖和构建产物
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist/apps/admin-api ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/admin-api/ecosystem.config.cjs ./

# 预创建上传目录并授予权限（供命名卷首次挂载继承）
RUN install -d -m 0755 -o nestjs -g nodejs /app/uploads \
 && install -d -m 0755 -o nestjs -g nodejs /app/logs \
 && install -d -m 0755 -o nestjs -g nodejs /app/.pm2 \
 && chown -R nestjs:nodejs /app

# 切换到非root用户
USER nestjs

RUN apk add --no-cache tzdata

ENV TZ="Asia/Shanghai"

# 暴露端口
EXPOSE 8080

# 使用 PM2 Runtime 作为容器进程管理器
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/prisma db seed && exec pm2-runtime ecosystem.config.cjs"]
