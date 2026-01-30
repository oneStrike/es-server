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

ensure_host_dir() {
    local dir="$1"
    local mode="${2:-0755}"
    if [ -z "${dir}" ]; then
        error "宿主机目录路径为空"
        return 1
    fi
    if [ -d "${dir}" ]; then
        return 0
    fi
    if command -v install &> /dev/null; then
        install -d -m "${mode}" "${dir}"
    else
        mkdir -p "${dir}"
        chmod "${mode}" "${dir}" || true
    fi
}

ensure_host_ownership() {
    local dir="$1"
    local uid="${2:-1001}"
    local gid="${3:-1001}"
    if [ "$(id -u)" -eq 0 ]; then
        chown -R "${uid}:${gid}" "${dir}"
        return $?
    fi
    if command -v sudo &> /dev/null; then
        sudo chown -R "${uid}:${gid}" "${dir}"
        return $?
    fi
    error "需要 root 或 sudo 才能 chown 宿主机目录：${dir}"
    return 1
}

cd "${PROJECT_ROOT}" || { error "切换到项目根目录失败"; exit 1; }

# 1. Check Environment
log "正在检查环境..."
if [ -f .env ]; then
    log "加载 .env 环境变量..."
    # 自动导出 .env 中的变量，以便 docker compose 可以读取
    # 使用 set -a 自动导出随后定义的变量
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
else
    warn "未找到 .env 文件，将使用默认环境变量或系统环境变量。"
fi

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

# 4. Prepare host directories for bind mounts (方案1：宿主机持久化目录)
if [ "${AUTO_DEPLOY_PREPARE_HOST_DIRS:-0}" = "1" ]; then
    HOST_UPLOADS_DIR="${HOST_UPLOADS_DIR:-./data/uploads}"
    HOST_LOGS_DIR="${HOST_LOGS_DIR:-./data/logs}"
    HOST_UID="${HOST_UID:-1001}"
    HOST_GID="${HOST_GID:-1001}"

    log "正在准备宿主机目录（用于 bind mount）..."
    ensure_host_dir "${HOST_UPLOADS_DIR}" || exit 1
    ensure_host_dir "${HOST_UPLOADS_DIR}/admin" || exit 1
    ensure_host_dir "${HOST_UPLOADS_DIR}/app" || exit 1
    ensure_host_ownership "${HOST_UPLOADS_DIR}" "${HOST_UID}" "${HOST_GID}" || exit 1

    ensure_host_dir "${HOST_LOGS_DIR}" || exit 1
    ensure_host_ownership "${HOST_LOGS_DIR}" "${HOST_UID}" "${HOST_GID}" || exit 1
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

# 6. Deploy Services
DEPLOY_TARGETS=""
if [ "${NEED_ADMIN}" = "true" ]; then
    DEPLOY_TARGETS="${DEPLOY_TARGETS} admin-server"
fi
if [ "${NEED_APP}" = "true" ]; then
    DEPLOY_TARGETS="${DEPLOY_TARGETS} app-server"
fi

# 去除首尾空格
DEPLOY_TARGETS=$(echo "${DEPLOY_TARGETS}" | xargs)

if [ -n "${DEPLOY_TARGETS}" ]; then
    log "正在部署变更的服务: ${DEPLOY_TARGETS} (及其依赖)..."
    # shellcheck disable=SC2086
    if docker compose up -d --remove-orphans ${DEPLOY_TARGETS}; then
        log "服务部署成功！"
    else
        error "服务部署失败，请检查 docker compose 日志。"
        exit 1
    fi
else
    log "没有服务需要部署。"
fi

# 7. Cleanup
log "正在清理无用镜像..."
docker image prune -f

# 8. Post-Deployment
if [ "$STASH_NEEDED" = true ]; then
    warn "正在恢复暂存的修改..."
    git stash pop
fi

log "所有操作完成。"
log "如需查看日志，请运行: docker compose logs -f"
exit 0
