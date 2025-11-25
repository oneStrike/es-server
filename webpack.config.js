const path = require('node:path')
const process = require('node:process')
const dotenv = require('dotenv')
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')
const workspace = require('./nest-cli.json')

function createConfig(projectName, mode) {
  const isDev = mode !== 'production'
  const projectPath = path.resolve(__dirname, 'apps', projectName)

  if (isDev) {
    dotenv.config({
      path: [
        path.resolve(projectPath, `.env.development`),
        path.resolve(projectPath, `.env`),
      ],
    })
  }

  return {
    name: projectName,
    entry: isDev
      ? ['webpack/hot/poll?100', path.join(projectPath, 'src', 'main.ts')]
      : path.join(projectPath, 'src', 'main.ts'),
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.cache/webpack', projectName),
    },
    externalsPresets: { node: true },
    externalsType: 'commonjs',
    target: 'node',
    externals: [
      nodeExternals({
        allowlist: isDev ? ['webpack/hot/poll?100'] : [],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: isDev,
              configFile: path.join(projectPath, 'tsconfig.app.json'),
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    mode: isDev ? 'development' : 'production',
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
      ...(isDev
        ? [
            new webpack.HotModuleReplacementPlugin(),
            new RunScriptWebpackPlugin({ name: 'main.js', autoRestart: true }),
          ]
        : [
            new webpack.BannerPlugin({
              banner: 'require("source-map-support").install();',
              raw: true,
            }),
          ]),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || (isDev ? 'development' : 'production'),
        ),
      }),
      new webpack.ProgressPlugin(),
    ],
    output: {
      path: path.join(__dirname, 'dist', 'apps', projectName),
      clean: true,
      filename: 'main.js',
    },
    devtool: isDev ? 'inline-source-map' : 'source-map',
    optimization: {
      usedExports: true,
      splitChunks: false,
      minimize: !isDev,
      moduleIds: isDev ? 'named' : 'deterministic',
      chunkIds: isDev ? 'named' : 'deterministic',
    },
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 150,
    },
    performance: { hints: false },
    snapshot: {
      managedPaths: [/^(.+)[\\\/]node_modules[\\\/]/],
      immutablePaths: [/^(.+)[\\\/]node_modules[\\\/]\.pnpm[\\\/]/],
    },
    stats: 'errors-warnings',
  }
}

module.exports = (env = {}) => {
  const mode = process.env.NODE_ENV || 'development'
  const projects = Object.keys(workspace.projects).filter(
    (n) => workspace.projects[n].type === 'application',
  )
  const requested = env.project

  if (requested === 'all') {
    return projects.map((p) => createConfig(p, mode))
  }

  if (requested && projects.includes(requested)) {
    return createConfig(requested, mode)
  }

  const defaultProject = path.basename(workspace.root)
  return createConfig(defaultProject, mode)
}
