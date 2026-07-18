import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

// Best-effort 加载 .env；DATABASE_URL 存在时注入 dbCredentials，
// 使 generate/check（不连库）和 migrate（连库）共用同一份配置。
if (existsSync('.env')) {
  loadEnvFile('.env')
}

const databaseUrl = env.DATABASE_URL?.trim()

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migration',
  schemaFilter: 'public',
  tablesFilter: ['*'],
  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  breakpoints: true,
  strict: true,
  verbose: true,
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
})
