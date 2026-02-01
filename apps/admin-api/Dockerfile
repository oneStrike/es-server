# syntax=docker/dockerfile:1.6
# --------------------------------
# Admin API 专用 Dockerfile (基于 Pnpm Workspace 优化)
# --------------------------------

# --------------------------------
# Stage 1: Builder
# --------------------------------
FROM node:24-alpine AS builder

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app
COPY . ./
RUN apk add --no-cache dumb-init tzdata


RUN pnpm install
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

RUN install -d -m 0755 -o nestjs -g nodejs /app/logs \
    /app/secrets \
    /app/uploads \
    /app/uploads/admin
EXPOSE 8080
ENV NODE_ENV=production \
    PORT=8080 \
    TZ="Asia/Shanghai"
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
USER nestjs
# 注意: 根据 tsconfig 编译输出，main.js 可能位于深层目录
CMD ["pnpm", "start:admin"]

