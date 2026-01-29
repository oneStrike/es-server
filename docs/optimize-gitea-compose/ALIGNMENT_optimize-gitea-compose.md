# Gitea & Runner 编排优化对齐文档

## 1. 项目上下文分析

### 现有架构
- **编排文件**: `docker-compose-gitea.yml`
- **服务组件**:
  - `gitea`: 使用 `docker.gitea.com/gitea:latest-rootless` 镜像。
  - `gitea-runner`: 使用 `docker.io/gitea/act_runner:latest` 镜像。
- **数据存储**:
  - Gitea 数据挂载于 `gitea-data` (Local Volume)。
  - 数据库目前未显式定义外部服务，推测使用内置 **SQLite**。
- **配置管理**:
  - 环境变量部分引用 `.gitea.env` (如 `GITEA_USER_UID`, `GITEA_SSH_PORT`)。
  - Runner 注册 Token 硬编码在 compose 文件中。
  - 引用了 `./gitea-runner-config.yaml`，但当前项目根目录下**缺失该文件**。

## 2. 优化建议与最佳实践

### 2.1 数据库优化 (Database)
- **现状**: 使用内置 SQLite。
- **建议**:
  - **生产环境**: 强烈建议使用独立的 **PostgreSQL** 或 **MySQL** 服务。SQLite 在高并发或数据量增长后性能受限，且备份管理不如独立数据库方便。
  - **个人/测试环境**: SQLite 足矣。
- **决策点**: 是否引入 PostgreSQL 服务？

### 2.2 Runner 配置与持久化 (Runner)
- **配置文件**:
  - `gitea-runner-config.yaml` 缺失会导致 Runner 启动失败或回退到默认不可控配置。
  - **建议**: 生成一份默认的配置文件并提交到版本控制，以便调整并发数、缓存策略等。
- **注册 Token**:
  - Token 硬编码在 `docker-compose.yml` 不安全且不灵活。
  - **建议**: 移动到 `.gitea.env` 文件中。
- **Docker 权限**:
  - 目前使用 Docker Socket 挂载 (DooD)，这是运行 Docker 任务的标准做法，但需注意安全性。
  - 确保 Runner 容器内的用户有权限访问 `/var/run/docker.sock`。

### 2.3 SSH 访问 (SSH)
- **现状**: 宿主机端口 `2222` 映射到容器 `2222`。
- **建议**:
  - 如果希望用户通过 `git clone git@domain:repo.git` (默认 22 端口) 访问，需要配置 SSH Passthrough（通过宿主机 SSH 转发到容器），或者接受用户必须使用 `ssh://git@domain:2222/...`。
  - 当前配置 `2222` 是清晰且安全的默认选择。

### 2.4 版本控制 (Versioning)
- **现状**: 使用 `latest` 标签。
- **建议**: 锁定具体版本号（如 `gitea:1.21-rootless`），避免自动升级导致的不兼容或意外中断。

### 2.5 资源限制 (Resources)
- **建议**: 为服务添加 `deploy.resources` 限制，防止内存泄漏耗尽宿主机资源。

## 3. 智能决策策略

基于 `es-server` 的项目规模和通常的企业级开发需求，我倾向于以下方案，请确认：

1.  **数据库**: 保持 **SQLite** (如果当前只是轻量部署) **或者** 升级为 **PostgreSQL** (如果是正式环境)。*考虑到迁移成本，如果当前数据在 SQLite，暂不强制迁移，但建议明确意图。* -> **请用户明确是否需要独立数据库。**
2.  **配置文件**: **立即创建** 默认的 `gitea-runner-config.yaml`。
3.  **Token**: 将 Token 提取到环境变量文件。
4.  **版本**: 建议锁定当前稳定版。

## 4. 待确认问题

1.  **数据库**: 是否需要添加 PostgreSQL 服务？(Yes/No，默认为 No，保持 SQLite)
2.  **Runner 配置文件**: 是否允许我为您生成一份标准的 `gitea-runner-config.yaml`？(Yes/No，默认为 Yes)
3.  **SSH**: 是否满意当前 2222 端口访问方式？(Yes/No，默认为 Yes)
