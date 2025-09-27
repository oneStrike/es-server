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

export default defineConfig({
  schema: path.join('prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx src/prisma/seed/index.ts',
  },
})
