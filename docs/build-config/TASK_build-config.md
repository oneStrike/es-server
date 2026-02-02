# 任务分解 - 添加打包配置

## 任务列表

### 任务 1: 修改 webpack.config.js
- **目标**: 区分 `development` 和 `production` 环境配置。
- **输入**: 现有的 `webpack.config.js`。
- **输出**: 修改后的 `webpack.config.js`。
- **实现约束**:
  - 使用 `process.env.NODE_ENV` 判断环境。
  - 生产环境移除 HMR 和 RunScriptWebpackPlugin。
  - 生产环境优化 sourcemap 设置。

### 任务 2: 验证生产构建
- **目标**: 确保 `pnpm build:admin` 成功运行。
- **验收标准**:
  - 构建成功无报错。
  - `dist/apps/admin-api/main.js` 生成。
  - 产物中不包含 HMR 热更新代码（可通过 grep 检查）。

### 任务 3: 验证开发启动
- **目标**: 确保 `pnpm start:admin` 依然正常工作。
- **验收标准**:
  - 服务正常启动。
  - HMR 依然有效（修改代码触发热更新）。

## 依赖关系
任务 1 -> 任务 2 -> 任务 3
