import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { Db as CoreDb } from '../core/drizzle.type'
import { relations } from '../relations'
import * as schema from '../schema'

export type Db = Omit<CoreDb, 'query'> & {
  query: Record<string, any>
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return url
}

export function createDbClient(connectionString: string): Db {
  const pool = new Pool({ connectionString })

  return drizzle({
    client: pool,
    schema,
    relations,
    casing: 'snake_case',
    logger: process.env.NODE_ENV === 'development',
  }) as Db
}

export async function disconnectDbClient(db: Db): Promise<void> {
  // @ts-expect-error - accessing internal pool for cleanup
  const pool = db.$client as Pool
  await pool.end()
}
