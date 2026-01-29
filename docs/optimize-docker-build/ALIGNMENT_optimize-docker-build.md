# 任务说明：优化构建过程降低 IO 负载

## 1. 项目现状分析
- **当前构建方式**：
  - 本地执行 `pnpm install` 和 `npm run build`。
  - Dockerfile 直接使用 `COPY ./node_modules` 和 `COPY ./dist` 将本地文件复制到镜像中。
  - `.dockerignore` 未忽略 `node_modules`。
- **问题根源**：
  - **构建上下文过大**：Docker Client 需要将巨大的 `node_modules` 文件夹（通常包含数万个小文件）发送给 Docker Daemon，导致极高的磁盘 IO 和 CPU 消耗。
  - **文件系统压力**：在 Windows/WSL 环境下，跨文件系统复制大量小文件性能极差。
  - **缓存失效**：每次本地依赖变动，整个 `node_modules` 层都需要重新复制，无法利用 Docker 层的缓存机制。

## 2. 优化方案：多阶段构建 (Multi-stage Build)

我们将构建过程迁移到 Docker 容器内部，利用 Docker 的分层缓存机制。

### 方案细节
1.  **修改 `.dockerignore`**：
    - 添加 `node_modules`。
    - 添加 `dist`。
    - 仅保留源码、配置和 lock 文件。

2.  **重构 `Dockerfile` (Admin API & App API)**：
    - **Stage 1: Builder**
        - 复制 `package.json`, `pnpm-lock.yaml`。
        - 运行 `pnpm install --frozen-lockfile` (利用缓存，仅当 lock 文件变更时才重跑)。
        - 复制源代码。
        - 运行 `prisma generate`。
        - 运行 `nest build`。
        - 运行 `pnpm prune --prod` 清理开发依赖。
    - **Stage 2: Runtime**
        - 从 Builder 阶段复制 `node_modules` (仅生产依赖)。
        - 从 Builder 阶段复制 `dist`。
        - 复制必要的配置和 Prisma 文件。

## 3. 预期收益
- **降低 IO**：不再发送 `node_modules` 到构建上下文，仅发送源码。
- **加快构建**：利用 Docker Layer Cache，依赖未变动时直接复用。
- **减小镜像**：确保仅包含生产依赖。

## 4. 风险与注意事项
- **构建时间**：首次构建需要下载依赖，时间可能较长（取决于网络）。后续构建将非常快。
- **环境一致性**：确保 Docker 内的 Node 版本与本地开发一致（当前使用 node:22-alpine，已一致）。
- **Prisma**：需要在构建阶段生成 Prisma Client，并确保复制到运行时镜像。

## 5. 执行计划
1.  创建/更新 `.dockerignore`。
2.  重构 `apps/admin-api/Dockerfile`。
3.  重构 `apps/app-api/Dockerfile`。
4.  验证构建。
