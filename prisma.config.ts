import path from 'node:path'
import { configDotenv } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

let seedCommand = ''

configDotenv({
  path: [
    path.resolve(__dirname, `.env.development`),
    path.resolve(__dirname, `.env`),
  ],
})

seedCommand = 'pnpm tsx libs/base/src/database/seed/index.ts'

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
