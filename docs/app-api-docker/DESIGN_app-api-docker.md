# DESIGN: app-api Dockerfile 调整

## 1. 整体架构
- **类型**: Dockerfile 修改。
- **模式**: 单阶段构建 (Single Stage) 或 简单的多阶段 (Deps + Runner)。
- **核心组件**: Node.js Runtime, Pnpm, Prisma Client, Compiled App Code。

## 2. 详细设计
- **Base Image**: `node:24-alpine`
- **文件复制**:
    - `package.json` (Root) -> `/app/package.json`
    - `pnpm-lock.yaml` -> `/app/pnpm-lock.yaml`
    - `prisma/` -> `/app/prisma/`
    - `dist/apps/app-api/` -> `/app/dist/apps/app-api/`
- **命令执行**:
    - `corepack enable`
    - `pnpm install --frozen-lockfile`
    - `pnpm prisma:generate`
- **Runtime Env**:
    - `PORT=8080` (假设)
    - `NODE_ENV=production`

## 3. 接口/契约
- **Input**: `dist` artifacts, `package.json`, `pnpm-lock.yaml`.
- **Output**: Runnable Docker Image.
