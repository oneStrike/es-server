import type { Config } from 'drizzle-kit'

export const drizzleKitConfig = {
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
} satisfies Config
