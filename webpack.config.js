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
  const allowlistedModules = [
    /^file-type(\/.*)?$/,
    /^@tokenizer\/inflate(\/.*)?$/,
    /^@tokenizer\/token(\/.*)?$/,
    /^strtok3(\/.*)?$/,
    /^token-types(\/.*)?$/,
    /^uint8array-extras(\/.*)?$/,
  ]

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
  })

  const config = {
    ...options,
    // 3. 启用 Webpack 5 持久化缓存
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.cache/webpack', projectName),
    },
  }
  const existingConditionNames = config.resolve?.conditionNames || []
  config.resolve = {
    ...config.resolve,
    conditionNames: [
      'import',
      ...existingConditionNames.filter(name => name !== 'import'),
    ],
  }

  if (isProduction) {
    // 生产环境配置
    config.devtool = 'source-map'
    config.externals = [
      nodeExternals({
        allowlist: allowlistedModules,
      }),
    ]
    config.plugins = [...options.plugins]
  } else {
    // 开发环境配置
    config.devtool = 'eval-cheap-module-source-map'
    config.entry = ['webpack/hot/poll?100', options.entry]
    config.externals = [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100', ...allowlistedModules],
      }),
    ]
    config.plugins = [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        autoRestart: false,
        // 5. 启用键盘控制 (输入 'rs' 回车可手动重启)
        keyboard: true,
      }),
    ]
  }

  return config
}
