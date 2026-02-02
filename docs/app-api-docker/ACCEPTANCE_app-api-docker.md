# ACCEPTANCE: app-api Dockerfile 调整 (v2)

## 1. 完成情况
- [x] **恢复构建**: Dockerfile 包含完整的 Builder 阶段，执行 `pnpm build:app`。
- [x] **Monorepo 支持**: 正确处理 workspace 依赖，使用 `pnpm deploy` 提取生产环境所需文件。
- [x] **Runtime 优化**: 仅包含生产依赖 (`node_modules`) 和构建产物 (`dist`)，基础镜像使用 alpine。
- [x] **路径修正**: 修正了 `dist` 目录在 deploy 过程中的丢失问题（手动 cp）。

## 2. 验证逻辑
- **构建流**: 
  Source -> Install (All Deps) -> Build -> Deploy (Prod Deps + Package.json) -> Copy Dist -> Final Image
- **产物内容**:
  `/app/dist/apps/app-api/main.js` (应用入口)
  `/app/node_modules` (生产依赖)
  `/app/prisma` (Prisma Client 支持)

## 3. 注意事项
- 由于使用了 `pnpm deploy`，它会创建一个隔离的目录结构。我们需要确保 `dist` 目录的层级在 COPY 之后与 CMD 指令匹配。目前假设 `dist` 内部保留了 `apps/app-api` 的结构。如果 `nest build` 输出是扁平的（直接在 dist 下），则 CMD 路径可能需要调整为 `dist/main.js`。基于 NestJS 默认行为，通常保留目录结构。

## 4. 构建命令建议
```bash
docker build -f apps/app-api/Dockerfile -t app-api .
```
