import type { SeedClientDb } from './db-client.type'
import process from 'node:process'
import { relations } from '@db/core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export type { Db } from './db-client.type'

/** Seed client 与其显式生命周期 owner。 */
export interface SeedDbClient {
  db: SeedClientDb
  pool: Pool
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return url
}

export function createDbClient(connectionString: string): SeedDbClient {
  const pool = new Pool({ connectionString })

  const db = drizzle({
    client: pool,
    relations,
    jit: true,
    logger: process.env.NODE_ENV === 'development',
  })

  return { db, pool }
}

export async function disconnectDbClient({ pool }: SeedDbClient) {
  await pool.end()
}
