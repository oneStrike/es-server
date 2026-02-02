# ALIGNMENT: 调整 app-api Dockerfile (修正版)

## 1. 需求变更分析
- **原始理解**: 误以为直接使用本地 `dist`，不再需要 Docker 内构建。
- **最新输入**: "Dockerfile依然需要打包文件，本机的只是示例"。
- **核心纠正**: **Dockerfile 必须包含构建步骤 (Builder Stage)**。本地的 `dist` 仅作为路径参考。
- **用户提示**: "目前很多文件都不需要copy了" -> 这可能指 Runtime 阶段应保持纯净，或者构建阶段 Copy 策略优化。但为了保证构建成功，源码（apps, libs, prisma, configs）在 Builder 阶段是必须的。

## 2. 修正后的方案
- **架构**: 恢复多阶段构建 (Builder -> Runtime)。
- **Builder 阶段**:
    1.  Base: `node:24-alpine`
    2.  Copy: 配置文件 (package.json, pnpm-workspace.yaml, tsconfig*, nest-cli.json)
    3.  Install: `pnpm install` (全量依赖)
    4.  Copy Source: `apps`, `libs`, `prisma`
    5.  Build: `pnpm build:app`
    6.  Deploy/Prune: 使用 `pnpm deploy` 提取生产依赖和 package.json 到临时目录，并将 `dist` 复制进去。
- **Runtime 阶段**:
    1.  Base: `node:24-alpine`
    2.  Copy: 从 Builder 阶段复制处理好的应用目录 (包含 node_modules 和 dist)。
    3.  Env: 设置端口和启动命令。

## 3. 关键路径确认
- 构建产物路径: `dist/apps/app-api`
- 启动入口: `dist/apps/app-api/main.js` (基于 NestJS Monorepo 默认行为，构建输出通常保留项目结构，或者根据 nest-cli.json 配置扁平化。之前用户确认了 `dist/apps/app-api` 路径有效)。

## 4. 最终共识
- 恢复 Dockerfile 的构建能力。
- 确保产物路径正确。
- 保持 Runtime 镜像精简。
