import path from 'node:path'
import process from 'node:process'
import { defineConfig, env } from 'prisma/config'

const seedCommand =
  process.env.NODE_ENV === 'production'
    ? 'node dist/libs/database/seed/index.js'
    : 'pnpm tsx src/prisma/seed/index.ts'

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
