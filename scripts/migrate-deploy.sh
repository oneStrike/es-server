#!/bin/sh
# ========================================
# Prisma 数据库迁移部署脚本
# ========================================
# 用于生产环境部署时运行数据库迁移
# 在容器启动前或作为初始化容器运行
# ========================================

set -e

echo "🔍 检查数据库连接..."

# 等待数据库就绪
max_attempts=30
attempt=0

until npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1 || [ $attempt -eq $max_attempts ]; do
  attempt=$((attempt + 1))
  echo "⏳ 等待数据库连接... (尝试 $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ 数据库连接失败，超时退出"
  exit 1
fi

echo "✅ 数据库连接成功"

# 运行数据库迁移
echo "🚀 开始执行数据库迁移..."
npx prisma migrate deploy

echo "✅ 数据库迁移完成"

# 可选：生成 Prisma Client（构建阶段已生成，此处可省略）
# echo "📦 生成 Prisma Client..."
# npx prisma generate

echo "🎉 数据库初始化完成，准备启动应用"
