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

# Current project context
CURRENT_PROJECT=""

# Helper Functions - with project prefix
log() { 
    local prefix=""
    [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: ${prefix}$1${NC}"; 
}
warn() { 
    local prefix=""
    [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: ${prefix}$1${NC}"; 
}
error() { 
    local prefix=""
    [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: ${prefix}$1${NC}"; 
}

# Git retry configuration
readonly MAX_RETRIES=5

# Git retry function - executes git command with retry logic (quiet mode)
# Usage: git_with_retry <git_args...>
git_with_retry() {
    local attempt=1

    while [ $attempt -le $MAX_RETRIES ]; do
        if git "$@" 2>/dev/null; then
            return 0
        fi

        [ $attempt -lt $MAX_RETRIES ] && sleep 1
        attempt=$((attempt + 1))
    done

    return 1
}

# Git Stash Helpers - Per-project stash state using associative array
declare -A STASH_NEEDED

# Cleanup function - restores stash for current directory (quiet)
cleanup_stash() {
    local dir=$(pwd)
    if [ "${STASH_NEEDED[$dir]:-false}" = true ]; then
        git stash pop 2>/dev/null || true
        STASH_NEEDED[$dir]=false
    fi
}

stash_changes() {
    local dir=$(pwd)
    if [[ -n $(git status -s) ]]; then
        warn "检测到本地修改，正在暂存..."
        git stash save "Auto-deploy stash $(date +'%Y-%m-%d %H:%M:%S')" 2>/dev/null
        STASH_NEEDED[$dir]=true
    else
        STASH_NEEDED[$dir]=false
    fi
}

# Docker build helper function (full output)
# Usage: docker_build <dockerfile_path> <build_args> <tags> <project_name>
docker_build() {
    local dockerfile_path="$1"
    local build_args="$2"
    local tags="$3"
    local build_name="$4"

    local cache_args=""
    [ "$FORCE_DEPLOY" = "true" ] && cache_args="--no-cache"

    # shellcheck disable=SC2086
    if docker build -f "$dockerfile_path" \
        $build_args \
        $cache_args \
        $tags \
        . ; then
        return 0
    else
        return 1
    fi
}

# Deploy single project function
deploy_project() {
    local project_dir="$1"
    local project_name="$2"

    # Set current project context for logging
    CURRENT_PROJECT="$project_name"

    if [ ! -d "$project_dir" ]; then
        error "项目目录不存在: $project_dir"
        CURRENT_PROJECT=""
        return 1
    fi

    pushd "$project_dir" > /dev/null || { error "无法切换到项目目录"; CURRENT_PROJECT=""; return 1; }

    # Set trap to ensure stash is restored on exit
    trap 'cleanup_stash; popd > /dev/null; CURRENT_PROJECT=""' EXIT

    stash_changes

    if ! git_with_retry symbolic-ref --short HEAD; then
        return 1
    fi
    local CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

    if ! git_with_retry fetch origin "${CURRENT_BRANCH}"; then
        return 1
    fi

    local LOCAL_HASH=$(git rev-parse HEAD)
    local REMOTE_HASH=$(git rev-parse "origin/${CURRENT_BRANCH}")

    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
        log "发现新版本，正在拉取 [$CURRENT_BRANCH]..."
        if ! git_with_retry pull origin "${CURRENT_BRANCH}"; then
            error "Git pull 失败"
            return 1
        fi
    else
        if [ "$FORCE_DEPLOY" = "true" ]; then
            log "强制部署 [$CURRENT_BRANCH]"
        else
            log "已是最新，跳过"
            return 0
        fi
    fi

    # 使用 es-server 的统一版本号
    local VERSION="${SERVER_VERSION}"

    export DOCKER_BUILDKIT=1

    # Build based on project type
    local BUILD_SUCCESS=false
    case "$project_name" in
        es-admin)
            # 前端预构建
            if [ -f "package.json" ]; then
                log "执行前端构建 (bun att:ele)..."
                if ! bun att:ele; then
                    error "前端构建失败"
                    return 1
                fi
            fi

            log "构建镜像 (v$VERSION)..."
            local DOCKERFILE_PATH="apps/web-ele/Dockerfile"
            if [ ! -f "$DOCKERFILE_PATH" ]; then
                error "找不到 Dockerfile"
                return 1
            fi
            # 匹配 docker-compose.yml: es-admin-web-ele:${SERVER_VERSION}
            if docker_build "$DOCKERFILE_PATH" "" "-t es-admin-web-ele:$VERSION" "es-admin"; then
                BUILD_SUCCESS=true
            else
                error "镜像构建失败"
                return 1
            fi
            ;;

        es-app-v2)
            # 前端预构建
            if [ -f "package.json" ]; then
                log "执行前端构建 (bun att)..."
                if ! bun att; then
                    error "前端构建失败"
                    return 1
                fi
            fi

            if [ -f "Dockerfile" ]; then
                log "构建镜像 (v$VERSION)..."
                # 匹配 docker-compose.yml: es-app-web:${SERVER_VERSION}
                if ! docker_build "./Dockerfile" "" "-t es-app-web:$VERSION" "$project_name"; then
                    error "镜像构建失败"
                    return 1
                fi
                BUILD_SUCCESS=true
            else
                warn "未找到 Dockerfile"
                BUILD_SUCCESS=true
            fi
            ;;

        es-server)
            log "构建镜像 (v$VERSION)..."
            BUILD_SUCCESS=true
            # 匹配 docker-compose.yml: es/admin/server:${SERVER_VERSION} 和 es/app/server:${SERVER_VERSION}
            if ! docker_build "./Dockerfile" "--build-arg APP_TYPE=admin" "-t es/admin/server:$VERSION" "admin-api"; then
                error "admin-api 构建失败"
                return 1
            fi
            if ! docker_build "./Dockerfile" "--build-arg APP_TYPE=app" "-t es/app/server:$VERSION" "app-api"; then
                error "app-api 构建失败"
                return 1
            fi
            ;;

        *)
            if [ -f "Dockerfile" ]; then
                log "构建镜像 (v$VERSION)..."
                local IMAGE_NAME="es/${project_name,,}"
                if ! docker_build "./Dockerfile" "" "-t $IMAGE_NAME:$VERSION" "$project_name"; then
                    error "镜像构建失败"
                    return 1
                fi
                BUILD_SUCCESS=true
            else
                warn "未找到 Dockerfile"
                BUILD_SUCCESS=true
            fi
            ;;
    esac

    popd > /dev/null
    trap - EXIT
    pushd "$ROOT_DIR" > /dev/null || { error "无法切换到根目录"; return 1; }

    local SERVICE_NAME=""
    case "$project_name" in
        es-admin)   SERVICE_NAME="admin" ;;
        es-app-v2)  SERVICE_NAME="app" ;;
        es-server)  SERVICE_NAME="app-server admin-server migrator" ;;
    esac

    if [ -n "$SERVICE_NAME" ]; then
        log "部署服务..."

        if [ "$project_name" = "es-server" ]; then
            docker compose stop app-server admin-server 2>/dev/null || true
        fi

        # shellcheck disable=SC2086
        if docker compose up -d --remove-orphans $SERVICE_NAME; then
            log "部署成功"
        else
            error "部署失败"
            popd > /dev/null
            return 1
        fi
    fi

    popd > /dev/null
    CURRENT_PROJECT=""

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

log "=== 多项目自动部署脚本启动 ==="

# 读取 es-server 的版本号作为统一版本
SERVER_VERSION="0.0.2"
if [ -f "${ROOT_DIR}/es-server/package.json" ]; then
    SERVER_VERSION=$(grep -m1 '"version":' "${ROOT_DIR}/es-server/package.json" | awk -F: '{ print $2 }' | sed 's/[", ]//g')
fi
log "统一版本号: v${SERVER_VERSION}"

if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    source "${ROOT_DIR}/.env" 2>/dev/null
    set +a
fi

if ! command -v docker &> /dev/null; then
    error "未找到 Docker 命令"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    error "Docker 未运行"
    exit 1
fi

if [ ! -f "${ROOT_DIR}/docker-compose.yml" ]; then
    error "未找到 docker-compose.yml"
    exit 1
fi

# Projects to deploy (in order)
PROJECTS=("es-admin" "es-app-v2" "es-server")
FAILURES=0

for PROJECT in "${PROJECTS[@]}"; do
    PROJECT_DIR="${ROOT_DIR}/${PROJECT}"
    if ! deploy_project "$PROJECT_DIR" "$PROJECT"; then
        FAILURES=$((FAILURES + 1))
    fi
done

echo ""
if [ $FAILURES -eq 0 ]; then
    log "✅ 所有项目部署成功"
else
    error "❌ $FAILURES 个项目部署失败"
fi

exit $FAILURES
