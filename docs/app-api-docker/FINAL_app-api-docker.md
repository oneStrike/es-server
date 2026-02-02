# FINAL: app-api Dockerfile 调整

## 1. 项目总结
本次任务成功调整了 `apps/app-api/Dockerfile`，以适应新的外部构建流程。

## 2. 主要变更
- **移除构建阶段**: 删除了容器内的源码编译过程。
- **引入外部产物**: 直接 COPY `dist/apps/app-api`。
- **优化依赖安装**: 针对 Monorepo 结构，复制根目录配置并安装所有依赖（确保运行时库存在）。
- **Prisma 支持**: 保留了 Prisma Client 的生成步骤。

## 3. 交付物
- 修改后的 `apps/app-api/Dockerfile`。
- 相关文档: ALIGNMENT, CONSENSUS, DESIGN, TASK, ACCEPTANCE。

## 4. 后续建议
- **构建命令**: 请确保在项目根目录执行构建命令，以保证上下文包含 `dist` 和 `package.json`。
    ```bash
    docker build -f apps/app-api/Dockerfile -t app-api .
    ```
- **依赖优化**: 当前 `package.json` 将所有依赖放在 `devDependencies`，导致生产镜像包含开发工具。建议未来将运行时依赖移动到 `dependencies`，以便使用 `--prod` 参数优化镜像体积。
