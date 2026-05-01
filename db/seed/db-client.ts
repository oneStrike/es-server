import type { Db, SeedQueryConfig } from './db-client.type'
import process from 'node:process'
import * as operators from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../schema'

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
    logger: process.env.NODE_ENV === 'development',
  }) as Db

  db.query = new Proxy(
    {},
    {
      get: (_target, tableKey) => {
        const table = (schema as Record<string, object>)[String(tableKey)]
        if (!table || typeof table !== 'object') {
          return undefined
        }

        return {
          findFirst: async (config?: SeedQueryConfig) => {
            const where =
              typeof config?.where === 'function'
                ? config.where(table, operators)
                : config?.where
            const rows =
              where === undefined
                ? await db.select().from(table).limit(1)
                : await db.select().from(table).where(where).limit(1)
            return rows[0]
          },
          findMany: async (config?: SeedQueryConfig) => {
            const where =
              typeof config?.where === 'function'
                ? config.where(table, operators)
                : config?.where
            return where === undefined
              ? db.select().from(table)
              : db.select().from(table).where(where)
          },
        }
      },
    },
  )

  return db
}

export async function disconnectDbClient(db: Db) {
  // @ts-expect-error - accessing internal pool for cleanup
  const pool = db.$client as Pool
  await pool.end()
}
