# CONSENSUS: 调整 app-api Dockerfile

## 1. 需求描述与验收标准
- **需求**: 更新 `apps/app-api/Dockerfile` 以使用预构建的 `dist` 产物，不再在 Docker 中进行构建。
- **验收标准**:
    - Dockerfile 能成功构建镜像。
    - 镜像包含 `dist/apps/app-api` 中的产物。
    - 镜像包含必要的 `node_modules`。
    - 启动命令正确指向 `main.js`。

## 2. 技术实现方案
- **基础镜像**: `node:24-alpine`。
- **构建步骤**:
    1.  初始化 pnpm 环境。
    2.  复制 `package.json`, `pnpm-lock.yaml` (根目录)。
    3.  复制 `prisma` 目录 (用于 Client 生成)。
    4.  执行 `pnpm install` (安装所有依赖，因为 prod 依赖也在 devDependencies 中)。
    5.  执行 `pnpm prisma:generate`。
    6.  复制 `dist/apps/app-api` 到容器内相应位置。
    7.  设置环境变量 `NODE_ENV=production` (运行时)。
    8.  设置启动命令。

## 3. 边界限制
- 假设 `dist/apps/app-api` 已经由外部构建流程准备好。
- 镜像体积可能较大（包含 devDependencies），暂不优化体积以确保功能优先。

## 4. 确认不确定性
- 已确认 `apps/app-api` 无独立 `package.json`，使用根目录配置。
- 已确认依赖在 `devDependencies`，需完整安装。
