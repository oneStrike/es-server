import path from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// 根据环境变量加载对应的 .env 文件
const env = process.env.NODE_ENV || 'development'
const envFiles = [`.env.${env}.local`, `.env.local`, `.env.${env}`, '.env']

// 按优先级加载环境变量文件
envFiles.forEach((file) => {
  config({ path: file, override: false })
})

// 在不同环境使用不同的 seed 命令：
// - 开发：直接使用 tsx 运行 TS 源码
// - 生产：使用构建后的 JS（dist）运行，避免容器内依赖 tsx/pnpm
const seedCommand =
  (process.env.NODE_ENV || 'development') === 'production'
    ? 'node dist/prisma/seed/index.js'
    : 'pnpm tsx src/prisma/seed/index.ts'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: seedCommand,
  },
})
