import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { configDotenv } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

let seedCommand = ''

if (process.env.NODE_ENV === 'production') {
  // 在生产环境中，尝试查找构建后的种子文件
  // 优先查找 admin-api 的构建产物，然后是 app-api
  const adminSeed = 'dist/apps/admin-api/libs/base/src/database/seed/index.js'
  const appSeed = 'dist/apps/app-api/libs/base/src/database/seed/index.js'

  if (fs.existsSync(path.resolve(adminSeed))) {
    seedCommand = `node ${adminSeed}`
  } else if (fs.existsSync(path.resolve(appSeed))) {
    seedCommand = `node ${appSeed}`
  } else {
    // 如果都找不到，回退到默认路径（可能会失败，但至少给出了路径提示）
    console.warn('Warning: Could not find compiled seed file in dist/. using default path.')
    seedCommand = 'node libs/base/src/database/seed/index.js'
  }
} else {
  configDotenv({
    path: [
      path.resolve(__dirname, `.env.development`),
      path.resolve(__dirname, `.env`),
    ],
  })

  seedCommand = 'pnpm tsx libs/base/src/database/seed/index.ts'
}

export default defineConfig({
  schema: path.join('prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: seedCommand,
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
