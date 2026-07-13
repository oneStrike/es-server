import type { Config } from 'drizzle-kit'
import { defineConfig } from 'drizzle-kit'

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
}) satisfies Config
