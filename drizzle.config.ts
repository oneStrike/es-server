import type { Config } from 'drizzle-kit'
import 'dotenv/config'
import { env } from 'node:process'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL 环境变量未设置，无法运行 Drizzle Kit')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migration',
  dbCredentials: {
    url: databaseUrl,
  },

  schemaFilter: 'public',
  tablesFilter: ['*'],

  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  breakpoints: true,
  strict: true,
  verbose: true,
}) satisfies Config
