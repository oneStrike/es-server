# 任务分解：优化 App API Dockerfile

## 任务列表

### 1. 分析与设计
- [x] 分析现有 `Dockerfile` 和项目结构 (`package.json`, `nest-cli.json`, `tsconfig.json`)。
- [x] 确定缓存优化策略 (Selective COPY)。
- [x] 确认构建输出路径。

### 2. 实施
- [x] 修改 `apps/app-api/Dockerfile`。
  - 调整 `COPY` 指令顺序。
  - 引入 `--mount=type=cache` (已存在，确认保留)。
  - 优化 `COPY` 源目录 (`libs`, `prisma`, `apps/app-api`)。
  - 确保 `pnpm deploy` 和 `node-prune` 流程正确。

### 3. 验证
- [x] 静态代码分析验证 (逻辑检查)。
- [ ] (可选) 本地构建测试 (需 Docker 环境)。

## 依赖关系
- 无外部依赖，仅依赖项目本身代码结构。
