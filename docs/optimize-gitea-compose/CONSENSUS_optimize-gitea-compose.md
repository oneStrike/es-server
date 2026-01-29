# Gitea & Runner 编排优化共识文档

## 1. 需求确认
- **目标**: 优化 Gitea 和 Runner 的 Docker Compose 编排配置。
- **范围**:
  - 创建缺失的 `gitea-runner-config.yaml`。
  - 优化敏感信息管理 (Token)。
  - 添加容器资源限制。
  - 保持现有数据库方案 (SQLite) 和 SSH 端口 (2222)。

## 2. 技术方案

### 2.1 Runner 配置文件 (`gitea-runner-config.yaml`)
- 创建标准配置文件。
- 关键配置:
  - `container.network`: 设置为 `gitea-network`，确保 Job 容器能与 Gitea 通信。
  - `container.docker_host`: `unix:///var/run/docker.sock`。
  - `cache.enabled`: `true`。

### 2.2 敏感信息管理
- 将 `GITEA_RUNNER_REGISTRATION_TOKEN` 从 compose 文件移动到 `.gitea.env`。

### 2.3 资源限制
- 在 `docker-compose-gitea.yml` 中为服务添加 `deploy.resources` 限制，防止资源耗尽。

### 2.4 版本与网络
- 保持 `latest-rootless` 标签 (用户未要求锁定特定版本)。
- 保持 `gitea-network` bridge 模式。

## 3. 验收标准
- `gitea-runner-config.yaml` 文件存在且配置正确。
- `docker-compose-gitea.yml` 无硬编码 Token。
- `.gitea.env` 包含 Token。
- `docker compose -f docker-compose-gitea.yml config` 验证通过 (若有环境需模拟)。
