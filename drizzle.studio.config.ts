import type { Config } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'
import { drizzleKitConfig } from './drizzle.shared.config'

const localEnvFile = '.env'

if (existsSync(localEnvFile)) {
  loadEnvFile(localEnvFile)
}

const databaseUrl = env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('db:studio 需要 DATABASE_URL')
}

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
