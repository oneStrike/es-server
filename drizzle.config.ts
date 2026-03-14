import type { Config } from 'drizzle-kit'
import { env } from 'node:process'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migration',
  dbCredentials: {
    url: env.DATABASE_URL!,
  },

  schemaFilter: 'public',
  tablesFilter: ['*'],

  migrations: {
    table: '__drizzle_migrations__',
    schema: 'public',
  },
  casing: 'snake_case',
  breakpoints: true,
  strict: true,
  verbose: true,
}) satisfies Config
