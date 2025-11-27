# 改造webpack配置文件，优化开发环境配置

## 1. 现状分析
当前webpack配置同时包含开发和生产环境的配置，结构复杂，包含了不必要的打包相关配置。

## 2. 改造目标
- 简化webpack配置，只保留开发环境需要的部分
- 去除生产环境的打包优化配置
- 优化开发环境的性能和体验
- 提高配置的可读性和维护性

## 3. 具体改造内容

### 3.1 简化配置结构
- 移除production相关的条件判断
- 只保留开发环境的配置逻辑
- 简化函数参数，只关注开发环境

### 3.2 优化entry配置
- 移除production环境的entry配置
- 只保留包含热重载的开发环境entry

### 3.3 优化插件配置
- 移除production环境的BannerPlugin
- 保留开发环境的HMR和RunScript插件
- 简化插件配置逻辑

### 3.4 优化optimization配置
- 移除production环境的优化配置（minimize, moduleIds, chunkIds）
- 保留开发环境需要的usedExports配置

### 3.5 优化output配置
- 简化output配置，只保留开发环境需要的部分
- 移除不必要的生产环境输出配置

### 3.6 优化devtool配置
- 保留开发环境的inline-source-map，提高调试体验

### 3.7 优化watchOptions
- 保留高效的watch配置，提高文件监听效率

### 3.8 移除seed文件处理
- 移除seed文件的特殊打包配置
- seed文件将通过其他方式处理（如直接使用tsx执行）

## 4. 预期效果
- 配置文件更简洁，可读性更高
- 开发环境构建速度更快
- 开发体验更好，热重载更高效
- 去除了不必要的打包相关配置

## 5. 改造后的配置结构
```javascript
const path = require('node:path')
const process = require('node:process')
const dotenv = require('dotenv')
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')
const workspace = require('./nest-cli.json')

function createConfig(projectName) {
  // 只保留开发环境配置
  const isDev = true
  const projectPath = path.resolve(__dirname, 'apps', projectName)

  // 加载环境变量
  dotenv.config({
    path: [
      path.resolve(projectPath, `.env.development`),
      path.resolve(projectPath, `.env`),
    ],
  })

  return {
    name: projectName,
    // 只保留开发环境的entry
    entry: ['webpack/hot/poll?100', path.join(projectPath, 'src', 'main.ts')],
    // 开发环境缓存配置
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.cache/webpack', projectName),
    },
    externalsPresets: { node: true },
    externalsType: 'commonjs',
    target: 'node',
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // 开发环境关闭类型检查，提高构建速度
              configFile: path.join(projectPath, 'tsconfig.app.json'),
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    mode: 'development',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
      symlinks: false,
      alias: {
        '@': path.resolve(projectPath, 'src'),
        '@libs/auth': path.resolve(__dirname, 'libs/auth/src'),
        '@libs/base': path.resolve(__dirname, 'libs/base/src'),
        '@libs/cache': path.resolve(__dirname, 'libs/cache/src'),
        '@libs/captcha': path.resolve(__dirname, 'libs/captcha/src'),
        '@libs/config': path.resolve(__dirname, 'libs/config/src'),
        '@libs/crypto': path.resolve(__dirname, 'libs/crypto/src'),
        '@libs/database': path.resolve(__dirname, 'libs/database/src'),
        '@libs/decorators': path.resolve(__dirname, 'libs/decorators/src'),
        '@libs/dto': path.resolve(__dirname, 'libs/dto/src'),
        '@libs/health': path.resolve(__dirname, 'libs/health/src'),
        '@libs/logger': path.resolve(__dirname, 'libs/logger/src'),
        '@libs/upload': path.resolve(__dirname, 'libs/upload/src'),
        '@libs/utils': path.resolve(__dirname, 'libs/utils/src'),
        '@libs/types': path.resolve(__dirname, 'libs/types/src'),
        '@libs/filters': path.resolve(__dirname, 'libs/filters/src'),
      },
      modules: ['node_modules', path.resolve(projectPath, 'src')],
    },
    plugins: [
      // 只保留开发环境的插件
      new webpack.HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({ name: 'main.js', autoRestart: true }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('development'),
      }),
      new webpack.ProgressPlugin(),
    ],
    output: {
      path: path.join(__dirname, 'dist', 'apps', projectName),
      clean: true,
      filename: 'main.js',
    },
    devtool: 'inline-source-map',
    optimization: {
      usedExports: true,
      splitChunks: false, // 开发环境关闭代码分割
    },
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 150,
    },
    performance: { hints: false },
    snapshot: {
      managedPaths: [/^(.+)[\\/]node_modules[\\/]/],
      immutablePaths: [/^(.+)[\\/]node_modules[\\/]\.pnpm[\\/]/],
    },
    stats: 'errors-warnings',
  }
}

module.exports = (env = {}) => {
  const projects = Object.keys(workspace.projects).filter(
    (n) => workspace.projects[n].type === 'application',
  )
  const requested = env.project

  if (requested === 'all') {
    return projects.map((p) => createConfig(p))
  }

  if (requested && projects.includes(requested)) {
    return createConfig(requested)
  }

  const defaultProject = path.basename(workspace.root)
  return createConfig(defaultProject)
}
```
