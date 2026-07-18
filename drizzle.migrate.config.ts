import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './drizzle.env'
import { drizzleKitConfig } from './drizzle.shared.config'

const databaseUrl = loadDatabaseUrl('db:migrate')

export default defineConfig({
  ...drizzleKitConfig,
  dbCredentials: {
    url: databaseUrl,
  },
}) satisfies Config
