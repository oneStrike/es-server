#!/bin/bash

# Multi-Project Auto Deploy Script
# Supports: es-admin, es-app-v2, es-server
# Function: Pull code, build images, and deploy using docker-compose
#
# Directory structure on server:
# /path/to/deploy/
# ├── auto-deploy.sh       (this script)
# ├── docker-compose.yml
# ├── .env
# ├── es-admin/
# ├── es-app-v2/
# └── es-server/

# Get script directory (root deployment directory)
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR="${SCRIPT_DIR}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper Functions
log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"; }

# Git retry configuration
# Retry immediately without delay, until success
RETRY_DELAY=0

# Git retry function
git_with_retry() {
    local cmd="$1"
    local attempt=1

    while true; do
        log "执行 Git 命令: $cmd (尝试 $attempt)"
        if eval "$cmd"; then
            log "Git 命令执行成功"
            return 0
        else
            warn "Git 命令失败，立即重试..."
            attempt=$((attempt + 1))
        fi
    done
}

# Git Stash Helpers
STASH_NEEDED=false

stash_changes() {
    if [[ -n $(git status -s) ]]; then
        warn "检测到本地修改，正在暂存..."
        git stash save "Auto-deploy stash $(date +'%Y-%m-%d %H:%M:%S')"
        STASH_NEEDED=true
    fi
}

pop_stash() {
    if [ "$STASH_NEEDED" = true ]; then
        warn "正在恢复暂存的修改..."
        git stash pop 2>/dev/null || true
        STASH_NEEDED=false
    fi
}

# Deploy single project function
deploy_project() {
    local project_dir="$1"
    local project_name="$2"

    log "========================================"
    log "开始部署项目: $project_name"
    log "项目目录: $project_dir"
    log "========================================"

    if [ ! -d "$project_dir" ]; then
        error "项目目录不存在: $project_dir"
        return 1
    fi

    cd "$project_dir" || { error "无法切换到项目目录"; return 1; }

    STASH_NEEDED=false

    log "开始 Git 操作..."
    stash_changes

    if ! git_with_retry "git symbolic-ref --short HEAD"; then
        pop_stash
        return 1
    fi
    CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
    log "当前分支: ${CURRENT_BRANCH}"

    log "正在检查远程更新..."
    if ! git_with_retry "git fetch origin \"${CURRENT_BRANCH}\""; then
        pop_stash
        return 1
    fi

    LOCAL_HASH=$(git rev-parse HEAD)
    REMOTE_HASH=$(git rev-parse "origin/${CURRENT_BRANCH}")
    CHANGED_FILES=$(git diff --name-only "${LOCAL_HASH}" "${REMOTE_HASH}" 2>/dev/null || true)

    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
        log "发现新版本，正在拉取..."
        if ! git_with_retry "git pull origin \"${CURRENT_BRANCH}\""; then
            error "Git pull 失败"
            pop_stash
            return 1
        fi
    else
        log "代码已是最新，无需部署。"
        if [ "$FORCE_DEPLOY" = "true" ]; then
            log "强制部署模式开启，继续执行..."
        else
            pop_stash
            log "跳过项目 $project_name"
            return 0
        fi
    fi

    if [ -f "package.json" ]; then
        VERSION=$(grep -m1 '"version":' package.json | awk -F: '{ print $2 }' | sed 's/[", ]//g')
    else
        VERSION="latest"
    fi
    log "项目版本: ${VERSION}"

    log "检查是否需要构建和部署..."
    export DOCKER_BUILDKIT=1

    # es-server 项目需要构建两个独立的镜像
    if [ "$project_name" = "es-server" ]; then
        log "构建 es-server 多镜像项目..."

        # 使用独立的缓存标签避免缓存污染
        ADMIN_CACHE_TAG="es_admin_server:cache"
        APP_CACHE_TAG="es_app_server:cache"

        # 构建 admin-api 镜像
        log "构建 admin-api 镜像..."
        if docker build -f "./Dockerfile" \
            --build-arg APP_TYPE=admin \
            --cache-from "$ADMIN_CACHE_TAG" \
            -t "es/admin/server:$VERSION" \
            -t "es/admin/server:latest" \
            . ; then
            log "admin-api 镜像构建成功"
        else
            error "admin-api 镜像构建失败"
            pop_stash
            return 1
        fi

        # 构建 app-api 镜像
        log "构建 app-api 镜像..."
        if docker build -f "./Dockerfile" \
            --build-arg APP_TYPE=app \
            --cache-from "$APP_CACHE_TAG" \
            -t "es/app/server:$VERSION" \
            -t "es/app/server:latest" \
            . ; then
            log "app-api 镜像构建成功"
        else
            error "app-api 镜像构建失败"
            pop_stash
            return 1
        fi
    elif [ -f "Dockerfile" ]; then
        # 其他项目使用默认构建方式
        log "找到 Dockerfile，开始构建镜像..."
        IMAGE_NAME="es/${project_name,,}"
        CACHE_TAG="${AUTO_DEPLOY_CACHE_TAG:-buildcache}"

        if docker build -f "./Dockerfile" \
            --cache-from "$IMAGE_NAME:$CACHE_TAG" \
            -t "$IMAGE_NAME:$VERSION" \
            -t "$IMAGE_NAME:$CACHE_TAG" \
            . ; then
            log "$project_name 镜像构建成功。"
        else
            error "$project_name 构建失败。"
            pop_stash
            return 1
        fi
    fi

    log "使用根目录的 docker-compose.yml 部署..."
    cd "$ROOT_DIR" || { error "无法切换到根目录"; return 1; }

    SERVICE_NAME=""
    case "$project_name" in
        es-admin)
            SERVICE_NAME="admin"
            ;;
        es-app-v2)
            SERVICE_NAME="app"
            ;;
        es-server)
            SERVICE_NAME="app-server admin-server migrator"
            ;;
    esac

    if [ -n "$SERVICE_NAME" ]; then
        log "正在部署服务: $SERVICE_NAME..."
        if docker compose up -d --remove-orphans $SERVICE_NAME; then
            log "$project_name 服务部署成功！"
        else
            error "$project_name 服务部署失败"
            return 1
        fi
    else
        warn "未找到对应的服务名称，跳过部署"
    fi

    cd "$project_dir" || { error "无法切换回项目目录"; return 1; }
    pop_stash

    log "========================================"
    log "$project_name 部署完成"
    log "========================================"
    echo ""

    return 0
}

# Main Execution
FORCE_DEPLOY=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -f|--force) FORCE_DEPLOY=true ;;
        *) warn "Unknown parameter passed: $1";;
    esac
    shift
done

log "========================================"
log "多项目自动部署脚本启动"
log "========================================"
echo ""

log "脚本目录: $SCRIPT_DIR"
log "根目录: $ROOT_DIR"
echo ""

log "正在检查环境..."
if [ -f "${ROOT_DIR}/.env" ]; then
    log "加载 .env 环境变量..."
    set -a
    source "${ROOT_DIR}/.env"
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

if [ ! -f "${ROOT_DIR}/docker-compose.yml" ]; then
    error "未找到 docker-compose.yml 文件 (${ROOT_DIR}/docker-compose.yml)"
    exit 1
fi

# Projects to deploy (in order)
PROJECTS=("es-admin" "es-app-v2" "es-server")
FAILURES=0

for PROJECT in "${PROJECTS[@]}"; do
    PROJECT_DIR="${ROOT_DIR}/${PROJECT}"
    if deploy_project "$PROJECT_DIR" "$PROJECT"; then
        log "$PROJECT 部署成功"
    else
        error "$PROJECT 部署失败"
        FAILURES=$((FAILURES + 1))
    fi
done

log "========================================"
log "所有项目部署完成"
if [ $FAILURES -eq 0 ]; then
    log "✅ 所有项目部署成功"
else
    error "❌ $FAILURES 个项目部署失败"
fi
log "========================================"
log "如需查看日志，请运行: docker compose logs -f"

exit $FAILURES
