# 系统架构设计 - 添加打包配置

## 1. 整体设计
目标是改造 `webpack.config.js`，使其成为一个环境感知的配置文件。

### 核心模块
- **Environment Detection**: 检测 `NODE_ENV`。
- **Conditional Configuration**:
  - **Development**: 启用 HMR, `RunScriptWebpackPlugin`, `eval-cheap-module-source-map`。
  - **Production**: 禁用 HMR, 禁用 `RunScriptWebpackPlugin`，使用 `source-map` 或禁用 sourcemap，确保 `nodeExternals` 正确排除依赖。

## 2. 接口契约
`webpack.config.js` 导出的函数签名保持不变：
```javascript
module.exports = function (options, webpack) { ... }
```

## 3. 模块依赖
依赖现有的 `webpack`, `webpack-node-externals`, `run-script-webpack-plugin`。
不需要引入新的 npm 包，除非需要压缩（Terser），但 Node.js 后端应用通常不需要混淆压缩，只需排除 `node_modules` 即可。

## 4. 异常处理
- 确保 `dotenv` 在生产环境也能正确加载（虽然生产环境通常通过系统环境变量注入，但保留 dotenv 作为一个选项也是好的，或者根据需求决定）。
- 注意 `entry` 的处理，开发环境是数组（包含 HMR client），生产环境通常是字符串或数组（只包含 main）。

## 5. 数据流向
`nest build` -> 读取 `nest-cli.json` -> 调用 `webpack` -> 加载 `webpack.config.js` -> 输出 `dist/`。
