const path = require('node:path')
const process = require('node:process')
const dotenv = require('dotenv')
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin')
const nodeExternals = require('webpack-node-externals')

module.exports = function (options, webpack) {
  const projectName = options.entry.includes('app-api')
    ? 'app-api'
    : 'admin-api'

  const isProduction = process.env.NODE_ENV === 'production'
  const shouldGenerateSourceMap = process.env.SOURCE_MAP !== 'false'
  const productionDevtool = shouldGenerateSourceMap
    ? process.env.SOURCE_MAP === 'true'
      ? 'source-map'
      : 'nosources-source-map'
    : false
  const allowlistedModules = [
    /^file-type(\/.*)?$/,
    /^@tokenizer\/inflate(\/.*)?$/,
    /^@tokenizer\/token(\/.*)?$/,
    /^strtok3(\/.*)?$/,
    /^token-types(\/.*)?$/,
    /^uint8array-extras(\/.*)?$/,
  ]
  const allowlist = (request) => {
    // 使用 300ms 轮询间隔，减少 CPU 占用
    if (request === 'webpack/hot/poll?300') {
      return true
    }
    return allowlistedModules.some((re) => re.test(request))
  }

  // 如果是 monorepo 结构，通常源码在 apps/项目名
  // 这里做一个简单的回退处理
  const appSrcPath = path.resolve(__dirname, 'apps', projectName)

  // 2. 动态加载环境变量
  dotenv.config({
    path: [
      path.resolve(appSrcPath, `.env.${process.env.NODE_ENV || 'development'}`),
      path.resolve(appSrcPath, '.env'),
      path.resolve(__dirname, '.env'), // 加载根目录兜底
    ],
    quiet: true,
  })

  const config = {
    ...options,
    mode: isProduction ? 'production' : 'development',
    // 3. 启用 Webpack 5 持久化缓存
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.cache/webpack', projectName),
      buildDependencies: {
        config: [
          __filename,
          path.resolve(__dirname, 'nest-cli.json'),
          path.resolve(__dirname, 'tsconfig.json'),
        ],
      },
    },
  }
  const existingConditionNames = config.resolve?.conditionNames || []
  config.resolve = {
    ...config.resolve,
    conditionNames: [
      'import',
      ...existingConditionNames.filter((name) => name !== 'import'),
    ],
  }

  if (isProduction) {
    // 生产环境配置
    config.devtool = productionDevtool
    config.externals = [
      nodeExternals({
        allowlist,
      }),
    ]
    config.plugins = [...options.plugins]
  } else {
    // 开发环境配置
    config.devtool = 'eval-cheap-module-source-map'
    config.entry = ['webpack/hot/poll?300', options.entry]
    config.externals = [
      nodeExternals({
        allowlist,
      }),
    ]
    // 新增：配置热更新文件输出位置，避免污染 dist 目录
    config.output = {
      ...options.output,
      hotUpdateChunkFilename: '.cache/hot/[id].[fullhash].hot-update.js',
      hotUpdateMainFilename: '.cache/hot/[runtime].[fullhash].hot-update.json',
    }
    // 新增：优化文件监听配置
    config.watchOptions = {
      ignored: /node_modules/,
      aggregateTimeout: 300, // 聚合变更，减少编译次数
    }
    config.plugins = [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [
          /\.js$/,
          /\.d\.ts$/,
          /node_modules/,
          /\.cache/,
          /dist/,
        ],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        // 修复：启用自动重启，进程异常退出时自动恢复
        autoRestart: true,
        // 修复：禁用信号处理，Windows 兼容性更好
        signal: false,
        // 启用键盘控制 (输入 'rs' 回车可手动重启)
        keyboard: true,
      }),
    ]
  }

  return config
}
