# 打包libs/database/src/seed目录为单独文件方案

## 1. 项目分析

* 项目是NestJS monorepo结构，使用webpack进行打包

* `libs/database/src/seed`目录包含数据库种子数据生成代码

* 目录结构：`index.ts`作为入口，`modules/`目录包含多个种子数据生成模块

## 2. 打包方案

### 方案：创建独立的webpack配置文件

**优点：**

* 独立配置，不影响现有打包逻辑

* 可以根据seed目录的需求进行专门配置

* 易于维护和扩展

**实现步骤：**

1. **创建webpack.seed.config.js文件**

   * 位于项目根目录

   * 配置seed目录为入口

   * 输出为单个文件

2. **配置内容**

   ```javascript
   const path = require('node:path');
   const process = require('node:process');
   const dotenv = require('dotenv');
   const webpack = require('webpack');
   const nodeExternals = require('webpack-node-externals');

   dotenv.config();

   module.exports = {
     name: 'seed',
     entry: path.join(__dirname, 'libs', 'database', 'src', 'seed', 'index.ts'),
     target: 'node',
     externals: [nodeExternals()],
     module: {
       rules: [
         {
           test: /\.tsx?$/,
           use: {
             loader: 'ts-loader',
             options: {
               configFile: path.join(__dirname, 'libs', 'database', 'tsconfig.json'),
             },
           },
           exclude: /node_modules/,
         },
       ],
     },
     resolve: {
       extensions: ['.tsx', '.ts', '.js', '.json'],
       alias: {
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
     },
     plugins: [
       new webpack.DefinePlugin({
         'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
       }),
       new webpack.ProgressPlugin(),
     ],
     output: {
       path: path.join(__dirname, 'dist', 'seed'),
       clean: true,
       filename: 'seed.js',
     },
     devtool: 'source-map',
     optimization: {
       usedExports: true,
       minimize: false,
     },
   };
   ```

3. **添加package.json脚本**

   ```json
   {
     "scripts": {
       "build:seed": "webpack --config webpack.seed.config.js --mode production"
     }
   }
   ```

4. **运行打包命令**

   ```bash
   npm run build:seed
   ```

5. **执行打包后的文件**

   ```bash
   node dist/seed/seed.js
   ```

## 3. 注意事项

* 确保webpack配置中的alias与现有配置保持一致

* 确保ts-loader使用正确的tsconfig.json文件

* 考虑是否需要将依赖项打包到输出文件中（当前配置使用nodeExternals，不打包node\_modules）

* 可以根据需要调整optimization配置，如是否需要minimize

## 4. 替代方案

### 方案二：修改现有webpack配置

* 在现有webpack.config.js中添加seed目录的打包配置

* 优点：复用现有配置逻辑

* 缺点：可能会使配置文件变得复杂

### 方案三：使用TypeScript编译器直接打包

* 为seed目录创建单独的tsconfig.json

* 使用tsc编译成单个文件

* 优点：配置简单

* 缺点：不支持webpack的高级特性

## 5. 推荐方案

推荐使用**方案一**，即创建独立的webpack配置文件，因为它具有以下优点：

* 独立配置，不影响现有打包逻辑

* 可以根据seed目录的需求进行专门配置

* 易于维护和扩展

* <br />
