import type { Db } from './db-client.type'
import process from 'node:process'
import { seedRelations } from '@db/core'
import * as schema from '@db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export type { Db } from './db-client.type'

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return url
}

export function createDbClient(connectionString: string) {
  const pool = new Pool({ connectionString })

  const db = drizzle({
    client: pool,
    schema: { ...schema, ...seedRelations },
    logger: process.env.NODE_ENV === 'development',
  })

  return db
}

export async function disconnectDbClient(db: Db) {
  // @ts-expect-error - accessing internal pool for cleanup
  const pool = db.$client as Pool
  await pool.end()
}
