import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseEnv } from 'node:util'
import { defineConfig } from 'prisma/config'

let DATABASE_URL = process.env.DATABASE_URL

if (process.env.NODE_ENV !== 'development') {
  // 使用 node:util 的 parseEnv 解析环境变量
  const envPath = path.join(process.cwd(), '.env')
  const envContent = fs.readFileSync(envPath, 'utf-8')
  DATABASE_URL = parseEnv(envContent).DATABASE_URL
}

export default defineConfig({
  schema: path.join('prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'pnpm tsx prisma/seed/index.ts',
  },
  datasource: {
    url: DATABASE_URL,
  },
})
