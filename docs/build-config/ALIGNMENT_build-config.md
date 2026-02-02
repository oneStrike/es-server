# 任务：添加打包配置

## 1. 项目上下文分析
- **项目类型**: NestJS Monorepo (Apps: `admin-api`, `app-api`; Libs: `base`, etc.)
- **构建工具**: Webpack (通过 `@nestjs/cli` 调用)
- **现有配置**:
  - `nest-cli.json` 指定使用 `webpack` builder。
  - `webpack.config.js` 存在，但主要针对开发环境配置 (HMR, RunScriptWebpackPlugin)。
  - `package.json` 中有 `build:admin` 和 `build:app` 命令，设置了 `NODE_ENV=production`。

## 2. 需求理解
用户希望添加/完善打包配置。
目前的 `webpack.config.js` 会无差别地应用 HMR 和 `RunScriptWebpackPlugin`，这在生产环境打包时是不需要的，甚至会导致错误（因为生产环境不需要 HMR，也不需要 `RunScriptWebpackPlugin` 来启动应用）。

**核心目标**:
修改 `webpack.config.js`，使其根据环境（开发 vs 生产）应用不同的配置。
- **开发环境**: 保留 HMR, Watch, RunScriptWebpackPlugin, eval-sourcemap。
- **生产环境**: 去除 HMR, RunScriptWebpackPlugin，使用合适的 sourcemap (或不使用)，可能需要压缩 (Terser)。

## 3. 疑问澄清
无明显歧义。这是一个标准的工程化任务：区分环境配置。

## 4. 智能决策
- **环境判断**: 通过 `process.env.NODE_ENV` 或 `options.mode` (如果 nest cli 传递的话) 来判断。`package.json` 中的 build 命令已经设置了 `NODE_ENV=production`。
- **配置分离**: 在 `webpack.config.js` 中添加条件判断。

## 5. 最终共识
我们将修改 `webpack.config.js` 以支持生产环境构建。

**验收标准**:
1. `pnpm build:admin` (生产模式) 能成功构建，且产物中不包含 HMR 相关代码。
2. `pnpm start:admin` (开发模式) 依然能正常工作，支持 HMR。
