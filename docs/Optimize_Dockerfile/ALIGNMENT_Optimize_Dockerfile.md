# 任务：优化 App API Dockerfile

## 1. 项目上下文分析
- **项目结构**: NestJS Monorepo (Pnpm Workspace)
- **目标应用**: `apps/app-api`
- **当前状态**:
  - 使用 `node:24-alpine`
  - 使用 `pnpm` 包管理器
  - 存在多阶段构建 (Builder + Runtime)
  - 问题: `COPY . .` 导致缓存失效频繁；构建上下文包含整个 monorepo。

## 2. 需求理解
- **目标**: 优化 Dockerfile 构建速度和镜像大小。
- **核心需求**:
  - 利用 Docker Layer Caching。
  - 减少不必要的重构建 (通过精确 COPY)。
  - 保持产物精简 (node-prune, pnpm deploy)。

## 3. 优化策略
- **构建上下文**: 必须在项目根目录运行 `docker build`。
- **Layer 优化**:
  1. 复制 workspace 配置 (`pnpm-workspace.yaml`, `pnpm-lock.yaml`) -> 安装依赖。
  2. 复制 `libs` 和 `apps/app-api` -> 避免因其他 app 变更导致重构建。
  3. `prisma generate` 单独层。
- **依赖管理**: 继续使用 `pnpm deploy --prod` 提取生产依赖。
- **清理**: 继续使用 `node-prune`。

## 4. 关键决策
- **COPY 策略**: 明确复制 `libs`, `prisma`, `apps/app-api` 目录，而不是 `.`。
- **CMD 路径**: 确认 `dist/apps/app-api/apps/app-api/src/main.js` 为当前 tsconfig 配置下的正确路径 (由于 `include` 包含 `../../libs` 导致 `rootDir` 提升至根目录)。

## 5. 最终共识
- 实施上述优化策略，更新 `apps/app-api/Dockerfile`。
