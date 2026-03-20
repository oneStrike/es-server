#!/bin/bash

# Local build and deploy script
# Uses local code only: no git fetch / pull / stash.
# Docker build keeps the default cache behavior.

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
if [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
  ROOT_DIR="${SCRIPT_DIR}"
else
  ROOT_DIR="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CURRENT_PROJECT=""
SERVER_VERSION="0.0.2"

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

usage() {
  cat <<'EOF'
Usage:
  bash scripts/auto-deploy-local.sh
  bash scripts/auto-deploy-local.sh es-server
  bash scripts/auto-deploy-local.sh es-admin es-app-v2 es-server

Notes:
  - 只使用本地代码构建，不执行任何 git 相关操作
  - docker build 默认走缓存，不会附加 --no-cache
EOF
}

resolve_project_dir() {
  local project_name="$1"

  case "$project_name" in
    es-admin)
      echo "${ROOT_DIR}/es-admin"
      ;;
    es-app-v2)
      echo "${ROOT_DIR}/es-app-v2"
      ;;
    es-server)
      if [ -d "${ROOT_DIR}/es-server" ]; then
        echo "${ROOT_DIR}/es-server"
      else
        echo "${ROOT_DIR}"
      fi
      ;;
    *)
      return 1
      ;;
  esac
}

project_exists() {
  local project_dir
  project_dir="$(resolve_project_dir "$1")" || return 1
  [ -d "$project_dir" ]
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

docker_build() {
  local project_dir="$1"
  local dockerfile_path="$2"
  shift 2

  (
    cd "$project_dir" || exit 1
    docker build -f "$dockerfile_path" "$@" .
  )
}

build_project() {
  local project_name="$1"
  local project_dir="$2"
  local version="$3"

  case "$project_name" in
    es-admin)
      log "构建镜像 (v$version)..."
      [ -f "${project_dir}/apps/web-ele/Dockerfile" ] || { error "找不到 Dockerfile"; return 1; }
      docker_build "$project_dir" "apps/web-ele/Dockerfile" -t "es-admin-web-ele:$version" || {
        error "镜像构建失败"
        return 1
      }
      ;;
    es-app-v2)
      if [ ! -f "${project_dir}/Dockerfile" ]; then
        warn "未找到 Dockerfile"
        return 0
      fi
      log "构建镜像 (v$version)..."
      docker_build "$project_dir" "./Dockerfile" -t "es-app-web:$version" || {
        error "镜像构建失败"
        return 1
      }
      ;;
    es-server)
      [ -f "${project_dir}/Dockerfile" ] || { error "找不到 Dockerfile"; return 1; }
      log "构建镜像 (v$version)..."
      docker_build "$project_dir" "./Dockerfile" --target runtime --build-arg APP_TYPE=admin -t "es/admin/server:$version" || {
        error "admin-api 构建失败"
        return 1
      }
      docker_build "$project_dir" "./Dockerfile" --target runtime --build-arg APP_TYPE=app -t "es/app/server:$version" || {
        error "app-api 构建失败"
        return 1
      }
      docker_build "$project_dir" "./Dockerfile" --target migrator -t "es/server-migrator:$version" || {
        error "migrator 构建失败"
        return 1
      }
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

    log "部署服务..."

    case "$project_name" in
      es-admin)
        docker compose up -d --remove-orphans --force-recreate admin
        ;;
      es-app-v2)
        docker compose up -d --remove-orphans --force-recreate app
        ;;
      es-server)
        log "启动 API 服务（迁移由 compose 编排自动处理）..."
        docker compose up -d --remove-orphans --force-recreate admin-server app-server
        ;;
    esac
  )
}

deploy_project() {
  local project_name="$1"
  local project_dir

  project_dir="$(resolve_project_dir "$project_name")" || {
    error "不支持的项目: $project_name"
    return 1
  }

  CURRENT_PROJECT="$project_name"

  if [ ! -d "$project_dir" ]; then
    error "项目目录不存在: $project_dir"
    CURRENT_PROJECT=""
    return 1
  fi

  build_project "$project_name" "$project_dir" "$SERVER_VERSION" || {
    CURRENT_PROJECT=""
    return 1
  }

  deploy_services "$project_name" || {
    error "部署失败"
    CURRENT_PROJECT=""
    return 1
  }

  log "部署成功"
  CURRENT_PROJECT=""
}

collect_projects() {
  local requested=("$@")
  local project
  local detected=()

  if [ "${#requested[@]}" -gt 0 ]; then
    echo "${requested[@]}"
    return 0
  fi

  for project in es-admin es-app-v2 es-server; do
    if project_exists "$project"; then
      detected+=("$project")
    fi
  done

  if [ "${#detected[@]}" -eq 0 ]; then
    return 1
  fi

  echo "${detected[@]}"
}

main() {
  local arg
  local projects=()
  local failures=0
  local project

  for arg in "$@"; do
    case "$arg" in
      -h|--help)
        usage
        return 0
        ;;
      es-admin|es-app-v2|es-server)
        projects+=("$arg")
        ;;
      *)
        warn "Unknown parameter passed: $arg"
        usage
        return 1
        ;;
    esac
  done

  log "=== 本地代码构建部署脚本启动 ==="

  read_server_version
  load_env
  check_requirements || return 1

  read -r -a projects <<< "$(collect_projects "${projects[@]}")" || {
    error "未找到可部署的本地项目"
    return 1
  }

  for project in "${projects[@]}"; do
    if ! deploy_project "$project"; then
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
