#!/bin/bash

# Multi-Project Auto Deploy Script
# Supports: es-admin, es-app-v2, es-server
# Function: Pull code, build images, and deploy using docker-compose

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CURRENT_PROJECT=""
FORCE_DEPLOY=false
SERVER_VERSION="0.0.2"

readonly GIT_TIMEOUT_SECONDS="${GIT_TIMEOUT_SECONDS:-90}"
readonly GIT_FETCH_TIMEOUT_SECONDS="${GIT_FETCH_TIMEOUT_SECONDS:-${GIT_FETCH_MAIN_TIMEOUT_SECONDS:-30}}"
readonly GIT_CONNECT_TIMEOUT_SECONDS="${GIT_CONNECT_TIMEOUT_SECONDS:-15}"
readonly GIT_LOW_SPEED_LIMIT="${GIT_LOW_SPEED_LIMIT:-1024}"
readonly GIT_LOW_SPEED_TIME="${GIT_LOW_SPEED_TIME:-30}"

log_with_level() {
  local color="$1"
  local level="$2"
  shift 2

  local prefix=""
  [ -n "$CURRENT_PROJECT" ] && prefix="【${CURRENT_PROJECT}】"
  echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] ${level}: ${prefix}$*${NC}"
}

log() {
  log_with_level "$GREEN" "INFO" "$@"
}

warn() {
  log_with_level "$YELLOW" "WARN" "$@"
}

error() {
  log_with_level "$RED" "ERROR" "$@"
}

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  if ! [[ "$timeout_seconds" =~ ^[0-9]+$ ]] || [ "$timeout_seconds" -le 0 ]; then
    "$@"
    return $?
  fi

  if command -v setsid > /dev/null 2>&1; then
    local timeout_flag
    local cmd_pid
    local watchdog_pid
    local exit_code

    timeout_flag="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/auto-deploy-timeout.$$.$RANDOM")"
    : > "$timeout_flag"

    setsid "$@" &
    cmd_pid=$!

    (
      sleep "$timeout_seconds"
      if kill -0 "$cmd_pid" 2> /dev/null; then
        echo "timeout" > "$timeout_flag"
        kill -TERM -- "-$cmd_pid" 2> /dev/null || true
        sleep 5
        kill -KILL -- "-$cmd_pid" 2> /dev/null || true
      fi
    ) &
    watchdog_pid=$!

    wait "$cmd_pid"
    exit_code=$?

    kill "$watchdog_pid" 2> /dev/null || true
    wait "$watchdog_pid" 2> /dev/null || true

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

git_network_until_success() {
  local timeout_seconds="$1"
  local timeout_message="$2"
  local wait_message="$3"
  local git_cmd="$4"
  shift 4

  local attempt=1
  local output
  local exit_code

  log "执行: $git_cmd"

  while true; do
    if [ "$attempt" -gt 1 ]; then
      warn "Retry #${attempt}: $git_cmd"
    fi

    output=$(
      GIT_TERMINAL_PROMPT=0 \
      GCM_INTERACTIVE=Never \
      GIT_ASKPASS= \
      GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=${GIT_CONNECT_TIMEOUT_SECONDS} -o ServerAliveInterval=30 -o ServerAliveCountMax=3" \
      run_with_timeout "$timeout_seconds" \
      git \
        -c credential.interactive=never \
        -c http.lowSpeedLimit="${GIT_LOW_SPEED_LIMIT}" \
        -c http.lowSpeedTime="${GIT_LOW_SPEED_TIME}" \
        "$@" 2>&1
    )
    exit_code=$?

    if [ "$exit_code" -eq 0 ]; then
      [ -n "$output" ] && log "输出: $output"
      return 0
    fi

    if [ "$exit_code" -eq 124 ]; then
      error "$timeout_message"
    else
      error "执行失败 (退出码: $exit_code)"
    fi
    [ -n "$output" ] && error "错误信息: $output"

    warn "$wait_message"
    sleep 1
    attempt=$((attempt + 1))
  done
}

git_fetch_branch_until_success() {
  local branch="$1"
  git_network_until_success \
    "$GIT_FETCH_TIMEOUT_SECONDS" \
    "Timed out (${GIT_FETCH_TIMEOUT_SECONDS}s), killed and retrying" \
    "Retrying in 1 second..." \
    "git fetch origin ${branch}" \
    fetch origin "$branch"
}

git_pull_branch_until_success() {
  local branch="$1"
  git_network_until_success \
    "$GIT_TIMEOUT_SECONDS" \
    "执行超时 (${GIT_TIMEOUT_SECONDS}s)" \
    "等待 1 秒后重试..." \
    "git pull origin ${branch}" \
    pull origin "$branch"
}

stash_changes() {
  if [[ -z "$(git status --porcelain --untracked-files=no)" ]]; then
    return 1
  fi

  warn "检测到本地修改，正在暂存..."
  git stash save "Auto-deploy stash $(date +'%Y-%m-%d %H:%M:%S')" > /dev/null 2>&1 || return 2
  return 0
}

restore_stash() {
  [ "$1" = "true" ] && git stash pop > /dev/null 2>&1 || true
}

docker_build() {
  local dockerfile_path="$1"
  shift

  local cmd=(docker build -f "$dockerfile_path")
  [ "$FORCE_DEPLOY" = "true" ] && cmd+=(--no-cache)
  cmd+=("$@" .)
  "${cmd[@]}"
}

build_project() {
  local project_name="$1"
  local version="$2"

  case "$project_name" in
    es-admin)
      log "构建镜像 (v$version)..."
      [ -f "apps/web-ele/Dockerfile" ] || { error "找不到 Dockerfile"; return 1; }
      docker_build "apps/web-ele/Dockerfile" -t "es-admin-web-ele:$version" || { error "镜像构建失败"; return 1; }
      ;;
    es-app-v2)
      if [ ! -f "Dockerfile" ]; then
        warn "未找到 Dockerfile"
        return 0
      fi
      log "构建镜像 (v$version)..."
      docker_build "./Dockerfile" -t "es-app-web:$version" || { error "镜像构建失败"; return 1; }
      ;;
    es-server)
      log "构建镜像 (v$version)..."
      docker_build "./Dockerfile" --build-arg APP_TYPE=admin -t "es/admin/server:$version" || { error "admin-api 构建失败"; return 1; }
      docker_build "./Dockerfile" --build-arg APP_TYPE=app -t "es/app/server:$version" || { error "app-api 构建失败"; return 1; }
      docker_build "./Dockerfile" --target migrator -t "es/server-migrator:$version" || { error "migrator 构建失败"; return 1; }
      ;;
  esac
}

deploy_services() {
  local project_name="$1"

  (
    cd "$ROOT_DIR" || {
      error "无法切换到根目录"
      exit 1
    }

    case "$project_name" in
      es-admin)
        log "部署服务..."
        if docker compose up -d --remove-orphans --force-recreate admin; then
          log "部署成功"
        else
          error "部署失败"
          exit 1
        fi
        ;;
      es-app-v2)
        log "部署服务..."
        if docker compose up -d --remove-orphans --force-recreate app; then
          log "部署成功"
        else
          error "部署失败"
          exit 1
        fi
        ;;
      es-server)
        log "部署服务..."
        log "启动 API 服务（迁移由 compose 编排自动处理）..."
        if ! docker compose up -d --remove-orphans --force-recreate admin-server app-server; then
          error "API 服务启动失败"
          exit 1
        fi
        ;;
    esac
  )
}

deploy_project_inner() {
  local project_name="$1"
  local current_branch
  local local_hash
  local remote_hash

  current_branch="$(git symbolic-ref --short HEAD 2> /dev/null)" || {
    error "无法获取当前分支"
    return 1
  }

  if [ "$FORCE_DEPLOY" = "true" ]; then
    log "强制部署 [$current_branch]，跳过远端检查"
  else
    git_fetch_branch_until_success "$current_branch" || return 1

    local_hash="$(git rev-parse HEAD 2> /dev/null)" || {
      error "无法获取本地版本"
      return 1
    }
    remote_hash="$(git rev-parse "origin/${current_branch}" 2> /dev/null)" || {
      error "无法获取远端版本"
      return 1
    }

    if [ "$local_hash" != "$remote_hash" ]; then
      log "发现新版本，正在拉取 [$current_branch]..."
      git_pull_branch_until_success "$current_branch" || {
        error "Git pull 失败"
        return 1
      }
    else
      log "已是最新，跳过"
      return 0
    fi
  fi

  export SERVER_VERSION
  export DOCKER_BUILDKIT=1

  build_project "$project_name" "$SERVER_VERSION" || return 1
  deploy_services "$project_name"
}

deploy_project() {
  local project_dir="$1"
  local project_name="$2"
  local stashed=false
  local status=0

  CURRENT_PROJECT="$project_name"

  if [ ! -d "$project_dir" ]; then
    error "项目目录不存在: $project_dir"
    CURRENT_PROJECT=""
    return 1
  fi

  pushd "$project_dir" > /dev/null || {
    error "无法切换到项目目录"
    CURRENT_PROJECT=""
    return 1
  }

  stash_changes
  case $? in
    0) stashed=true ;;
    2)
      error "本地修改暂存失败"
      status=1
      ;;
  esac

  if [ "$status" -eq 0 ]; then
    deploy_project_inner "$project_name" || status=$?
  fi

  restore_stash "$stashed"
  popd > /dev/null || true
  CURRENT_PROJECT=""

  return "$status"
}

read_server_version() {
  local package_file
  local version

  for package_file in "${ROOT_DIR}/es-server/package.json" "${ROOT_DIR}/package.json"; do
    [ -f "$package_file" ] || continue
    version="$(sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$package_file" | head -n 1)"
    [ -n "$version" ] && SERVER_VERSION="$version"
    break
  done

  log "统一版本号: v${SERVER_VERSION}"
}

load_env() {
  if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    source "${ROOT_DIR}/.env" 2> /dev/null
    set +a
  fi
}

check_requirements() {
  if ! command -v docker > /dev/null 2>&1; then
    error "未找到 Docker 命令"
    return 1
  fi

  if ! docker info > /dev/null 2>&1; then
    error "Docker 未运行"
    return 1
  fi

  if [ ! -f "${ROOT_DIR}/docker-compose.yml" ]; then
    error "未找到 docker-compose.yml"
    return 1
  fi
}

main() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      -f|--force) FORCE_DEPLOY=true ;;
      *) warn "Unknown parameter passed: $1" ;;
    esac
    shift
  done

  log "=== 多项目自动部署脚本启动 ==="

  read_server_version
  load_env
  check_requirements || return 1

  local failures=0
  local project
  local projects=("es-admin" "es-app-v2" "es-server")

  for project in "${projects[@]}"; do
    if ! deploy_project "${ROOT_DIR}/${project}" "$project"; then
      failures=$((failures + 1))
      if [ "$project" = "es-server" ]; then
        error "【es-server】部署失败，终止后续流程"
        break
      fi
      warn "【${project}】部署失败，继续执行下一个项目"
    fi
  done

  echo ""
  if [ "$failures" -eq 0 ]; then
    log "✅ 所有项目部署成功"
  else
    error "❌ $failures 个项目部署失败"
  fi

  return "$failures"
}

main "$@"
exit $?
