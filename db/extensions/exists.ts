import type { SQL } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'

export async function exists(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
): Promise<boolean> {
  const result = await db.select().from(table).where(where).limit(1)
  return result.length > 0
}
