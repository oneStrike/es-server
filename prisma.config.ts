import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseEnv } from 'node:util'
import { defineConfig } from 'prisma/config'

// 使用 node:util 的 parseEnv 解析环境变量
const envPath = path.join(process.cwd(), '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

let seedCommand = ''

seedCommand = 'pnpm tsx prisma/seed/index.ts'

export default defineConfig({
  schema: path.join('prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: seedCommand,
  },
  datasource: {
    url: env.DATABASE_URL as string,
  },
})
