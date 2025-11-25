const path = require('node:path')
const dotenv = require('dotenv')
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

module.exports = (env) => {
  const projectName = env.project
  const projectPath = path.resolve(__dirname, `apps/${projectName}`)
  dotenv.config({
    path: [
      path.resolve(projectPath, `.env.development`),
      path.resolve(projectPath, `.env`),
    ],
  })
  return {
    entry: ['webpack/hot/poll?100', `${projectPath}/src/main.ts`],
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
              // 启用转译模式，提高编译速度
              transpileOnly: true,
              // 获取类型检查信息但不阻塞编译
              getCustomTransformers: () => ({
                before: [],
              }),
              // 编译器选项
              compilerOptions: {
                // 保持与tsconfig.json一致，但优化热重载
                incremental: true,
                tsBuildInfoFile: path.resolve(projectPath, '.tsbuildinfo'),
              },
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    mode: 'development',
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
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
      // 优化模块解析
      modules: ['node_modules', path.resolve(projectPath, 'src')],
    },
    plugins: [
      new webpack.HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({
        name: `${projectName}-server.js`,
        autoRestart: false,
      }),
    ],
    output: {
      path: path.join(projectPath, 'dist'),
      filename: `${projectName}-server.js`,
    },
    // 性能优化
    optimization: {
      // 移除未使用的导出
      usedExports: true,
      // 不进行代码分割（Node.js不需要）
      splitChunks: false,
      // 不压缩代码（开发模式）
      minimize: false,
    },
  }
}
