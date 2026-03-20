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
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: ${prefix}$1${NC}"
}
warn() {
    local prefix=""
    [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: ${prefix}$1${NC}"
}
error() {
    local prefix=""
    [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: ${prefix}$1${NC}"
}

# Git retry configuration
readonly MAX_RETRIES=5
readonly GIT_TIMEOUT_SECONDS="${GIT_TIMEOUT_SECONDS:-90}"
readonly GIT_FETCH_TIMEOUT_SECONDS="${GIT_FETCH_TIMEOUT_SECONDS:-${GIT_FETCH_MAIN_TIMEOUT_SECONDS:-30}}"
readonly GIT_CONNECT_TIMEOUT_SECONDS="${GIT_CONNECT_TIMEOUT_SECONDS:-15}"
readonly GIT_LOW_SPEED_LIMIT="${GIT_LOW_SPEED_LIMIT:-1024}"
readonly GIT_LOW_SPEED_TIME="${GIT_LOW_SPEED_TIME:-30}"

# Run command with hard timeout and kill the whole process group on timeout.
# Returns 124 when timeout is reached.
run_with_timeout() {
    local timeout_seconds="$1"
    shift

    if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]] || [ "$timeout_seconds" -le 0 ]; then
        "$@"
        return $?
    fi

    # Preferred path: manual watchdog + process-group termination.
    # It guarantees cleanup before the next retry starts.
    if command -v setsid > /dev/null 2>&1; then
        local timeout_flag
        local cmd_pid
        local watchdog_pid
        local exit_code
        timeout_flag="$(mktemp 2>/dev/null || echo "/tmp/auto-deploy-timeout.$$.$RANDOM")"
        : > "$timeout_flag"

        setsid "$@" &
        cmd_pid=$!

        (
            sleep "$timeout_seconds"
            if kill -0 "$cmd_pid" 2>/dev/null; then
                echo "timeout" > "$timeout_flag"
                kill -TERM -- "-$cmd_pid" 2>/dev/null || true
                sleep 5
                kill -KILL -- "-$cmd_pid" 2>/dev/null || true
            fi
        ) >/dev/null 2>&1 &
        watchdog_pid=$!

        wait "$cmd_pid"
        exit_code=$?

        kill "$watchdog_pid" 2>/dev/null || true
        wait "$watchdog_pid" 2>/dev/null || true

        if [ -s "$timeout_flag" ]; then
            rm -f "$timeout_flag"
            return 124
        fi

        rm -f "$timeout_flag"
        return "$exit_code"
    fi

    if command -v timeout > /dev/null 2>&1; then
        timeout -k 5s "${timeout_seconds}s" "$@"
        return $?
    fi

    "$@"
}

# Execute a git command with env isolation. Prints output and returns exit code.
# Usage: _run_git_cmd <git_args...>
_run_git_cmd() {
    local output
    local exit_code
    output=$(
        GIT_TERMINAL_PROMPT=0 \
        GCM_INTERACTIVE=Never \
        GIT_ASKPASS= \
        GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=${GIT_CONNECT_TIMEOUT_SECONDS} -o ServerAliveInterval=30 -o ServerAliveCountMax=3" \
        run_with_timeout "$GIT_TIMEOUT_SECONDS" \
        git \
            -c credential.interactive=never \
            -c http.lowSpeedLimit="${GIT_LOW_SPEED_LIMIT}" \
            -c http.lowSpeedTime="${GIT_LOW_SPEED_TIME}" \
            "$@" 2>&1
    )
    exit_code=$?
    if [ -n "$output" ]; then
        if [ $exit_code -eq 0 ]; then
            log "输出: $output"
        else
            error "错误信息: $output"
        fi
    fi
    return "$exit_code"
}

# Git retry function - executes git command with retry logic.
# Only retries on timeout (exit code 124); other failures are returned immediately.
# Usage: git_with_retry <git_args...>
git_with_retry() {
    local attempt=1
    local git_cmd="git $*"
    local exit_code

    log "执行: $git_cmd"

    while [ $attempt -le $MAX_RETRIES ]; do
        if [ $attempt -gt 1 ]; then
            warn "第 $attempt 次重试: $git_cmd"
        fi

        _run_git_cmd "$@"
        exit_code=$?

        if [ $exit_code -eq 0 ]; then
            return 0
        fi

        # 非超时错误（认证失败、仓库问题等）不重试，直接失败
        if [ $exit_code -ne 124 ]; then
            error "执行失败 (退出码: $exit_code)，不重试"
            return "$exit_code"
        fi

        error "执行超时 (${GIT_TIMEOUT_SECONDS}s)"

        if [ $attempt -lt $MAX_RETRIES ]; then
            warn "等待 1 秒后重试..."
            sleep 1
        fi
        attempt=$((attempt + 1))
    done

    error "$git_cmd 在 $MAX_RETRIES 次尝试后仍然失败"
    return 1
}

# Dedicated policy for: git fetch origin <branch>
# Retries indefinitely on timeout; returns immediately on non-timeout errors.
git_fetch_branch_until_success() {
    local branch="$1"
    local attempt=1
    local git_cmd="git fetch origin ${branch}"
    local exit_code

    log "执行: $git_cmd"

    while true; do
        if [ $attempt -gt 1 ]; then
            warn "Retry #${attempt}: $git_cmd"
        fi

        GIT_TERMINAL_PROMPT=0 \
        GCM_INTERACTIVE=Never \
        GIT_ASKPASS= \
        GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=${GIT_CONNECT_TIMEOUT_SECONDS} -o ServerAliveInterval=30 -o ServerAliveCountMax=3" \
        run_with_timeout "$GIT_FETCH_TIMEOUT_SECONDS" \
        git \
            -c credential.interactive=never \
            -c http.lowSpeedLimit="${GIT_LOW_SPEED_LIMIT}" \
            -c http.lowSpeedTime="${GIT_LOW_SPEED_TIME}" \
            fetch origin "${branch}" 2>&1 | while IFS= read -r line; do log "输出: $line"; done
        # 通过管道会丢失退出码，需要用 PIPESTATUS
        exit_code="${PIPESTATUS[0]}"

        if [ $exit_code -eq 0 ]; then
            return 0
        fi

        # 非超时错误（如认证失败、仓库不存在）直接失败，不无限重试
        if [ $exit_code -ne 124 ]; then
            error "Fetch 失败 (退出码: $exit_code)，停止重试"
            return "$exit_code"
        fi

        error "Fetch 超时 (${GIT_FETCH_TIMEOUT_SECONDS}s)，killed and retrying"
        warn "Retrying in 1 second..."
        sleep 1
        attempt=$((attempt + 1))
    done
}

# Git Stash Helpers - Per-project stash state using associative array
declare -A STASH_NEEDED

# Restore stash for the given directory (quiet)
cleanup_stash_for_dir() {
    local dir="$1"
    if [ "${STASH_NEEDED[$dir]:-false}" = true ]; then
        git -C "$dir" stash pop 2>/dev/null || true
        STASH_NEEDED[$dir]=false
    fi
}

stash_changes() {
    local dir
    dir="$(pwd)"
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

    local cache_args=""
    [ "$FORCE_DEPLOY" = "true" ] && cache_args="--no-cache"

    # shellcheck disable=SC2086
    docker build -f "$dockerfile_path" \
        $build_args \
        $cache_args \
        $tags \
        .
}

# Deploy single project function.
# Returns 0 on success, 1 on failure (caller continues to next project).
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

    stash_changes

    local CURRENT_BRANCH
    CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null)" || {
        error "获取当前分支失败"
        cleanup_stash_for_dir "$project_dir"
        popd > /dev/null
        CURRENT_PROJECT=""
        return 1
    }
    log "当前分支: $CURRENT_BRANCH"

    if ! git_fetch_branch_until_success "${CURRENT_BRANCH}"; then
        error "Fetch 失败，跳过此项目"
        cleanup_stash_for_dir "$project_dir"
        popd > /dev/null
        CURRENT_PROJECT=""
        return 1
    fi

    local LOCAL_HASH REMOTE_HASH
    LOCAL_HASH=$(git rev-parse HEAD)
    REMOTE_HASH=$(git rev-parse "origin/${CURRENT_BRANCH}")

    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
        log "发现新版本，正在拉取 [$CURRENT_BRANCH]..."
        if ! git_with_retry pull origin "${CURRENT_BRANCH}"; then
            error "Git pull 失败，跳过此项目"
            cleanup_stash_for_dir "$project_dir"
            popd > /dev/null
            CURRENT_PROJECT=""
            return 1
        fi
    else
        if [ "$FORCE_DEPLOY" = "true" ]; then
            log "强制部署 [$CURRENT_BRANCH]"
        else
            log "已是最新，跳过"
            cleanup_stash_for_dir "$project_dir"
            popd > /dev/null
            CURRENT_PROJECT=""
            return 0
        fi
    fi

    # 使用 es-server 的统一版本号
    local VERSION="${SERVER_VERSION}"

    export DOCKER_BUILDKIT=1

    # Build based on project type
    local build_failed=false
    case "$project_name" in
        es-admin)
            log "构建镜像 (v$VERSION)..."
            local DOCKERFILE_PATH="apps/web-ele/Dockerfile"
            if [ ! -f "$DOCKERFILE_PATH" ]; then
                error "找不到 Dockerfile"
                build_failed=true
            elif ! docker_build "$DOCKERFILE_PATH" "" "-t es-admin-web-ele:$VERSION"; then
                error "镜像构建失败"
                build_failed=true
            fi
            ;;

        es-app-v2)
            if [ -f "Dockerfile" ]; then
                log "构建镜像 (v$VERSION)..."
                if ! docker_build "./Dockerfile" "" "-t es-app-web:$VERSION"; then
                    error "镜像构建失败"
                    build_failed=true
                fi
            else
                warn "未找到 Dockerfile，跳过构建"
            fi
            ;;

        es-server)
            log "构建镜像 (v$VERSION)..."
            if ! docker_build "./Dockerfile" "--build-arg APP_TYPE=admin" "-t es/admin/server:$VERSION"; then
                error "admin-api 构建失败"
                build_failed=true
            elif ! docker_build "./Dockerfile" "--build-arg APP_TYPE=app" "-t es/app/server:$VERSION"; then
                error "app-api 构建失败"
                build_failed=true
            fi
            ;;

        *)
            if [ -f "Dockerfile" ]; then
                log "构建镜像 (v$VERSION)..."
                local IMAGE_NAME="es/${project_name,,}"
                if ! docker_build "./Dockerfile" "" "-t $IMAGE_NAME:$VERSION"; then
                    error "镜像构建失败"
                    build_failed=true
                fi
            else
                warn "未找到 Dockerfile，跳过构建"
            fi
            ;;
    esac

    cleanup_stash_for_dir "$project_dir"
    popd > /dev/null

    if [ "$build_failed" = true ]; then
        CURRENT_PROJECT=""
        return 1
    fi

    # ── Deploy ──────────────────────────────────────────────────────────────
    pushd "$ROOT_DIR" > /dev/null || { error "无法切换到根目录"; CURRENT_PROJECT=""; return 1; }

    local deploy_failed=false
    case "$project_name" in
        es-admin)
            log "部署服务 admin..."
            docker compose rm -s -f admin 2>/dev/null || true
            if ! docker compose up -d --force-recreate --remove-orphans admin; then
                error "admin 部署失败"
                deploy_failed=true
            fi
            ;;

        es-app-v2)
            log "部署服务 app..."
            docker compose rm -s -f app 2>/dev/null || true
            if ! docker compose up -d --force-recreate --remove-orphans app; then
                error "app 部署失败"
                deploy_failed=true
            fi
            ;;

        es-server)
            log "执行数据库迁移 (migrator)..."
            docker compose rm -s -f migrator 2>/dev/null || true
            if ! docker compose up -d --force-recreate migrator; then
                error "migrator 启动失败"
                deploy_failed=true
            fi

            if [ "$deploy_failed" = false ]; then
                log "重启 admin-server..."
                docker compose rm -s -f admin-server 2>/dev/null || true
                if ! docker compose up -d --force-recreate --remove-orphans admin-server; then
                    error "admin-server 启动失败"
                    deploy_failed=true
                fi
            fi

            if [ "$deploy_failed" = false ]; then
                log "重启 app-server..."
                docker compose rm -s -f app-server 2>/dev/null || true
                if ! docker compose up -d --force-recreate --remove-orphans app-server; then
                    error "app-server 启动失败"
                    deploy_failed=true
                fi
            fi
            ;;

        *)
            local SERVICE_NAME="es/${project_name,,}"
            log "部署服务 $SERVICE_NAME..."
            docker compose rm -s -f "$SERVICE_NAME" 2>/dev/null || true
            if ! docker compose up -d --force-recreate --remove-orphans "$SERVICE_NAME"; then
                error "部署失败"
                deploy_failed=true
            fi
            ;;
    esac

    popd > /dev/null
    CURRENT_PROJECT=""

    if [ "$deploy_failed" = true ]; then
        return 1
    fi

    log "部署成功"
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
    SERVER_VERSION=$(grep -m1 '"version":' "${ROOT_DIR}/es-server/package.json" | awk -F: '{ print $2 }' | sed 's/[\", ]//g')
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
        warn "项目 $PROJECT 失败，继续处理下一个项目..."
    fi
done

echo ""
if [ $FAILURES -eq 0 ]; then
    log "✅ 所有项目部署成功"
else
    error "❌ $FAILURES 个项目部署失败"
fi

exit $FAILURES
