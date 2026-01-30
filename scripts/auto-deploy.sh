#!/bin/bash

# Auto Deploy Script for @akaiito/server-nestjs
# Function: Pull code, install deps, build images, and deploy using docker-compose

# Get script directory
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_ROOT="${SCRIPT_DIR}/../"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"; }

cd "${PROJECT_ROOT}" || { error "切换到项目根目录失败"; exit 1; }

# 1. Check Environment
log "正在检查环境..."
if ! command -v docker &> /dev/null; then
    error "未找到 Docker 命令。"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    error "Docker 未运行。请启动 Docker。"
    exit 1
fi

# 2. Git Operations
log "开始 Git 操作..."
STASH_NEEDED=false
if [[ -n $(git status -s) ]]; then
    warn "检测到本地修改，正在暂存..."
    git stash save "Auto-deploy stash $(date +'%Y-%m-%d %H:%M:%S')"
    STASH_NEEDED=true
fi

CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
log "当前分支: ${CURRENT_BRANCH}"

log "正在检查远程更新..."
git fetch origin "${CURRENT_BRANCH}"
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/${CURRENT_BRANCH}")
CHANGED_FILES=$(git diff --name-only "${LOCAL_HASH}" "${REMOTE_HASH}" 2>/dev/null || true)

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
    log "发现新版本，正在拉取..."
    if ! git pull origin "${CURRENT_BRANCH}"; then
        error "Git pull 失败。"
        [ "$STASH_NEEDED" = true ] && git stash pop
        exit 1
    fi
else
    log "代码已是最新，无需部署。"
    if [ "$STASH_NEEDED" = true ]; then
        warn "正在恢复暂存的修改..."
        git stash pop
    fi
    exit 0
fi

# 3. Dependencies and Version
# Read version from package.json
if [ -f "package.json" ]; then
    VERSION=$(grep -m1 '"version":' package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
else
    VERSION="latest"
fi
log "项目版本: ${VERSION}"

if [ "${AUTO_DEPLOY_LOCAL_PNPM:-0}" = "1" ] && command -v pnpm &> /dev/null; then
    log "正在更新本地依赖..."
    pnpm install
    log "正在生成 Prisma Client..."
    pnpm prisma:generate
fi

# 4. Build Images
log "开始构建 Docker 镜像..."

NEED_ADMIN=false
NEED_APP=false
if echo "${CHANGED_FILES}" | grep -Eq '^(libs/|prisma/|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|tsconfig(\.|$)|tsconfig\.build\.json$|nest-cli\.json$|webpack\.config\.js$)'; then
    NEED_ADMIN=true
    NEED_APP=true
else
    if echo "${CHANGED_FILES}" | grep -Eq '^apps/admin-api/'; then NEED_ADMIN=true; fi
    if echo "${CHANGED_FILES}" | grep -Eq '^apps/app-api/'; then NEED_APP=true; fi
fi

if [ "${NEED_ADMIN}" != "true" ] && [ "${NEED_APP}" != "true" ]; then
    log "代码更新不影响镜像构建，跳过构建。"
    if [ "$STASH_NEEDED" = true ]; then
        warn "正在恢复暂存的修改..."
        git stash pop
    fi
    exit 0
fi

export DOCKER_BUILDKIT=1
ADMIN_IMAGE="es/admin/server"
APP_IMAGE="es/app/server"
CACHE_TAG="${AUTO_DEPLOY_CACHE_TAG:-buildcache}"

ADMIN_PID=""
APP_PID=""
ADMIN_STATUS=0
APP_STATUS=0

if [ "${NEED_ADMIN}" = "true" ]; then
    log "构建 Admin Server (${ADMIN_IMAGE}:${VERSION})..."
    docker build -f apps/admin-api/Dockerfile \
        --cache-from "${ADMIN_IMAGE}:${CACHE_TAG}" \
        -t "${ADMIN_IMAGE}:${VERSION}" \
        -t "${ADMIN_IMAGE}:${CACHE_TAG}" \
        . &
    ADMIN_PID=$!
fi

if [ "${NEED_APP}" = "true" ]; then
    log "构建 App Server (${APP_IMAGE}:${VERSION})..."
    docker build -f apps/app-api/Dockerfile \
        --cache-from "${APP_IMAGE}:${CACHE_TAG}" \
        -t "${APP_IMAGE}:${VERSION}" \
        -t "${APP_IMAGE}:${CACHE_TAG}" \
        . &
    APP_PID=$!
fi

if [ -n "${ADMIN_PID}" ]; then
    wait "${ADMIN_PID}" || ADMIN_STATUS=$?
fi
if [ -n "${APP_PID}" ]; then
    wait "${APP_PID}" || APP_STATUS=$?
fi

if [ "${ADMIN_STATUS}" -ne 0 ]; then
    error "Admin Server 构建失败。"
    exit 1
fi
if [ "${APP_STATUS}" -ne 0 ]; then
    error "App Server 构建失败。"
    exit 1
fi

if [ "${NEED_ADMIN}" = "true" ]; then log "Admin Server 镜像构建成功。"; fi
if [ "${NEED_APP}" = "true" ]; then log "App Server 镜像构建成功。"; fi

# 5. Build Complete
log "所有镜像构建完成。"
log "跳过 Docker Compose 部署 (如需部署请手动执行: docker compose up -d)。"

# 6. Post-Deployment
if [ "$STASH_NEEDED" = true ]; then
    warn "正在恢复暂存的修改..."
    git stash pop
fi

log "所有操作完成。"
exit 0
