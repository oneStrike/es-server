## 问题分析

日志显示的是编译后的 JavaScript 文件路径 (`E:\Code\es\es-server\dist\apps\admin-api\main.js:1818:15`)，而不是原始的 TypeScript 文件路径。

## 为什么需要手动启用 Source Map 支持？

1. **Node.js 设计原则**：Node.js 不会自动使用 source map 文件，这是设计决定，因为：
   - 性能考虑：解析 source map 文件会增加运行时开销
   - 安全性考虑：source map 文件可能包含敏感的源代码信息
   - 灵活性考虑：允许开发者根据需要选择是否启用

2. **两种启用方式**：
   - **方案一**：在代码中手动引入 `source-map-support/register`
   - **方案二**：使用 Node.js 原生的 `--enable-source-maps` 命令行选项（Node.js v12+ 支持）

3. **项目现状**：
   - 已安装 `source-map-support` 依赖
   - `tsconfig.json` 中已设置 `sourceMap: true`，会生成 `.map` 文件
   - 使用的是 Node.js v24.11.1，完全支持 `--enable-source-maps` 选项

## 推荐解决方案

**方案二：使用 Node.js 原生的 `--enable-source-maps` 命令行选项**

### 实现步骤

1. **修改 `package.json` 中的启动脚本**：
   - 在 `start:prod` 脚本中添加 `--enable-source-maps` 选项
   - 修改前：`"start:prod": "node dist/apps/admin-api/main.js"`
   - 修改后：`"start:prod": "node --enable-source-maps dist/apps/admin-api/main.js"`

2. **如果使用 PM2 或其他进程管理器**：
   - 在启动命令中添加 `--enable-source-maps` 选项

3. **验证修复效果**：
   - 重新构建应用：`pnpm build:all`
   - 运行应用并触发错误，检查日志是否显示原始 TypeScript 文件路径

## 替代方案（方案一）

如果不想修改启动脚本，可以在入口文件中引入 `source-map-support/register`：

1. 在 `apps/admin-api/src/main.ts` 和 `apps/client-api/src/main.ts` 文件顶部添加：
   ```typescript
   import 'source-map-support/register'
   ```

2. 重新构建应用并运行

## 预期效果

修复后，错误日志将显示原始 TypeScript 文件路径，例如：
```
BadRequestException: 页面路径 "/terms" 已存在
    at ClientPageService.updatePage (E:\Code\es\es-server\apps\admin-api\src\modules\client\page\page.service.ts:139:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
```

## 为什么推荐使用命令行选项？

1. **原生支持**：`--enable-source-maps` 是 Node.js 原生支持的选项，不需要额外的依赖
2. **性能更好**：原生实现比第三方库性能更好
3. **更灵活**：可以根据环境（开发/生产）选择是否启用
4. **无需修改代码**：不需要在代码中添加额外的导入语句
5. **支持所有文件**：包括第三方库的 source map 文件

## 生产环境建议

1. **开发环境**：建议启用 source map 支持，方便调试
2. **生产环境**：
   - 如果需要调试生产环境的错误，可以启用 source map 支持
   - 否则，建议关闭，以提高性能和安全性
   - 可以通过环境变量或配置文件控制是否启用

## 最终推荐方案

使用 Node.js 原生的 `--enable-source-maps` 命令行选项，修改 `package.json` 中的启动脚本，这样既不需要修改代码，又能获得更好的性能和灵活性。