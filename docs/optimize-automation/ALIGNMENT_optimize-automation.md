# 自动化流程优化方案

## 1. 现状分析

### 1.1 当前 CI/CD 流程 (`.gitea/workflows/ci.yml`)
- **触发条件**: Main 分支 Push/PR, Tags。
- **构建环境**: `ubuntu-latest`, Node 24 (注意：项目 Dockerfile 使用的是 Node 22，这里有版本不一致风险)。
- **主要步骤**:
  1.  Checkout 代码。
  2.  Setup Node (但后续其实主要依赖 Docker Build)。
  3.  提取版本号。
  4.  Setup Docker Buildx。
  5.  构建并推送 Admin 镜像。
  6.  构建并推送 App 镜像。
  7.  清理镜像。
- **缺失环节**:
  - **代码质量检查**: 没有运行 Lint。
  - **自动化测试**: 没有运行 Unit Test 或 E2E Test。
  - **类型检查**: 没有运行 TypeScript 类型检查。
  - **构建缓存**: 仅使用了 Docker Layer 缓存，未对 Node Modules 或其他中间产物进行针对性缓存优化（虽然移除了本地构建，这一点现在影响较小）。

### 1.2 `package.json` 脚本能力
- `lint`: `eslint` 检查。
- `type-check`: `tsc` 类型检查。
- `test`: `jest` 单元测试。
- `test:e2e`: E2E 测试。
- 这些脚本目前均未在 CI 中被调用。

## 2. 优化方案

### 2.1 引入 "Quality Gate" (质量门控)
在构建镜像之前，必须通过代码质量检查和测试。这可以防止有问题的代码被打包成镜像。

**建议新增 Job: `quality-check`**
- **Lint**: 运行 `pnpm lint`。
- **Type Check**: 运行 `pnpm type-check`。
- **Unit Test**: 运行 `pnpm test` (可选，视项目测试覆盖率现状而定，建议先加上)。

### 2.2 统一 Node 版本
- CI 环境 (`.gitea/workflows/ci.yml`) 使用的是 Node 24。
- Dockerfile 使用的是 Node 22。
- **建议**: 统一使用 Node 22 (LTS)，确保开发、CI 和生产环境一致。

### 2.3 优化构建与推送策略
- **并行构建**: 目前 Admin 和 App 是串行构建的。可以将它们拆分为两个并行的 Job，或者在同一个 Job 中并行运行（如果资源允许）。Gitea Actions 通常支持 `matrix` 策略。
- **缓存优化**: 继续保持 Docker Layer 缓存。

### 2.4 增加自动发布 Release (可选)
- 如果是 Tag 触发，可以自动创建 Gitea Release 并附带变更日志。

## 3. 实施计划 (Draft)

我们将修改 `.gitea/workflows/ci.yml`，将其拆分为两个主要阶段：
1.  **Check**: 运行 Lint, Type Check, Test。
2.  **Build**: 仅当 Check 通过后，运行 Docker Build & Push。

### 3.1 更新后的 Workflow 结构预览

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node (22)
      - Setup pnpm
      - Install Dependencies
      - Lint
      - Type Check
      - Test (Optional)

  build-push:
    needs: quality-check
    runs-on: ubuntu-latest
    if: github.event_name != 'pull_request' # PR 通常只做检查，不推送镜像(除非有临时仓库)
    strategy:
      matrix:
        service: [admin, app]
    steps:
      - Checkout
      - Setup Docker Buildx
      - Build & Push ${{ matrix.service }}
```

**注意**: 考虑到目前是单体仓库 (Monorepo)，一次 Push 可能只修改了 Admin 或 App，但构建两个镜像也无妨，Docker 缓存会处理未变更的部分。

## 4. 待确认事项
- **测试现状**: 项目中的测试用例是否都能通过？如果不能，直接加入 CI 会导致流水线失败。
- **Gitea Runner 资源**: 并行构建可能会消耗更多资源，Runner 是否扛得住？

## 5. 推荐行动
1.  **统一 Node 版本**: 将 CI 中的 Node 版本改为 22。
2.  **添加 `quality-check` Job**: 包含 Lint 和 Type Check。暂不强制 Unit Test，除非确认测试通过。
3.  **优化 Build Job**: 使用 Matrix 策略并行构建 Admin 和 App (如果 Runner 支持)。

我们将先创建 Alignment 文档，然后执行修改。
