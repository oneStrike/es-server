const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')
const workspace = require('./nest-cli.json')

function createConfig(projectName) {
  // 只保留开发环境配置
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
        // 动态生成libs目录下的alias映射
        ...fs
          .readdirSync(path.resolve(__dirname, 'libs'))
          .filter((item) =>
            fs.statSync(path.resolve(__dirname, 'libs', item)).isDirectory(),
          )
          .reduce((acc, libName) => {
            acc[`@libs/${libName}`] = path.resolve(
              __dirname,
              'libs',
              libName,
              'src',
            )
            return acc
          }, {}),
      },
      modules: ['node_modules', path.resolve(projectPath, 'node_modules'), path.resolve(projectPath, 'src')],
    },
    plugins: [
      // 只保留开发环境的插件
      new webpack.HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({ name: 'main.js', autoRestart: false }),
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
    devtool: 'eval-source-map',
    optimization: {
      usedExports: true,
      splitChunks: false, // 开发环境关闭代码分割
      minimize: false,
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
