import path from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

const envName = process.env.NODE_ENV || 'development'
const envFiles = [
  `.env.${envName}.local`,
  `.env.local`,
  `.env.${envName}`,
  '.env',
]
envFiles.forEach((file) => config({ path: file, override: false }))

const seedCommand =
  envName === 'production'
    ? 'node dist/prisma/seed/index.js'
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
