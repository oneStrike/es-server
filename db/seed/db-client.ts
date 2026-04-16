import type { Db as CoreDb } from '../core/drizzle.type'
import process from 'node:process'
import * as operators from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../schema'

export type Db = Omit<CoreDb, 'query'> & {
  query: Record<
    string,
    {
      findFirst?: (config?: { where?: object | ((table: object, ops: typeof operators) => object) }) => Promise<object | undefined>
      findMany?: (config?: { where?: object | ((table: object, ops: typeof operators) => object) }) => Promise<object[]>
    }
  >
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

  const db = drizzle({
    client: pool,
    schema,
    casing: 'snake_case',
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
          findFirst: async (config?: { where?: object | ((table: object, ops: typeof operators) => object) }) => {
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
          findMany: async (config?: { where?: object | ((table: object, ops: typeof operators) => object) }) => {
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

export async function disconnectDbClient(db: Db): Promise<void> {
  // @ts-expect-error - accessing internal pool for cleanup
  const pool = db.$client as Pool
  await pool.end()
}
