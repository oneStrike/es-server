# 优化构建过程降低 IO 负载 - 最终共识

## 1. 问题确认
- **现象**：构建过程导致服务器 IO 负载过高。
- **原因**：
  - **CI 冗余构建**：CI 流程中先在 Runner 本地执行了 `pnpm install` 和 `build`，随后 Docker 构建又可能重复此过程（或传输巨大上下文）。
  - **构建上下文过大**：Docker 构建时，将包含数万个文件的 `node_modules` 和 `dist` 发送给 Docker Daemon，导致极高的磁盘 IO 和 CPU 消耗。
  - **文件系统压力**：在 Gitea Runner 环境中，频繁的小文件读写和跨进程复制是性能瓶颈。

## 2. 解决方案
实施 **多阶段构建 (Multi-stage Build)** 并优化 CI 流程。

### 2.1 优化 Gitea CI 流程 (`.gitea/workflows/ci.yml`)
- **移除本地构建步骤**：删除了 `pnpm install`, `pnpm build:all`, `pnpm prune --prod` 步骤。
- **职责分离**：Runner 仅负责代码检出和触发 Docker 构建，不再承担编译和依赖管理任务。

### 2.2 修改 `.dockerignore`
- 忽略 `node_modules` 和 `dist`。
- 阻断了本地文件向 Docker Daemon 的传输，确保构建上下文（Context）仅包含源代码。

### 2.3 重构 Dockerfile
针对 `apps/admin-api` 和 `apps/app-api` 实施了相同的多阶段构建策略：

- **Stage 1: Builder**
  - 基于 `node:22-alpine`。
  - 复制 `package.json`, `pnpm-lock.yaml` 并安装依赖（利用 Docker Layer Cache）。
  - 复制源码 (`apps`, `libs`, `tsconfig`, `prisma` 等)。
  - 执行 `prisma generate` 和 `nest build`。
  - 执行 `pnpm prune --prod` 移除开发依赖。

- **Stage 2: Runtime**
  - 基于 `node:22-alpine`。
  - 仅从 Builder 阶段复制经过剪裁的 `node_modules` 和编译产物 `dist`。
  - 复制运行时必要的配置。
  - 使用 PM2 启动服务。

## 3. 预期效果
- **IO 负载大幅降低**：消除了 Runner 本地的重型文件操作，消除了 Docker Context 的大数据传输。
- **构建速度提升**：
  - 本地 Runner 不再需要下载和解压 npm 包。
  - Docker 构建充分利用缓存，依赖未变更时瞬间完成。
- **标准化与一致性**：构建环境完全由 Dockerfile 定义，不受 Runner 环境差异影响。

## 4. 验证与后续
- 代码已修改并保存。
- 建议提交代码后观察 Gitea Actions 的运行日志和服务器监控。
