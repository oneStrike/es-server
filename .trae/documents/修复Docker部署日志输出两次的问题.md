## 问题分析

通过分析代码和构建配置，发现Docker部署后日志输出两次的原因是：

1. `apps/admin-api/tsconfig.app.json` 文件的 `include` 字段包含了 `"../../libs/**/*"`
2. 这导致 `nest build admin-api` 命令将所有 libs 目录下的代码编译到了 `dist/apps/admin-api/libs/` 目录下
3. 当应用运行时，Node.js 可能会从多个路径加载同一个模块（如 `dist/apps/admin-api/libs/` 和 `dist/libs/`）
4. 这导致 `@libs/base` 模块被加载两次，从而使 `logStartupInfo` 函数被调用两次

## 解决方案

修改 `apps/admin-api/tsconfig.app.json` 文件，移除 `"../../libs/**/*"` 从 `include` 字段中，让 libs 目录由它们自己的 tsconfig 文件编译。

## 实施步骤

1. 编辑 `apps/admin-api/tsconfig.app.json` 文件
2. 将 `include` 字段从 `["src/**/*", "../../libs/**/*"]` 修改为 `["src/**/*"]`
3. 重新构建应用
4. 测试 Docker 部署是否只输出一次日志

## 预期结果

- Docker 部署后，启动日志只输出一次
- 构建过程更加高效，只编译应用代码
- 模块加载更加清晰，避免重复加载