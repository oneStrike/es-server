import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { and, isNull } from 'drizzle-orm'

export async function existsActive(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
): Promise<boolean> {
  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const deletedAtColumn = tableAsRecord.deletedAt

  if (!deletedAtColumn) {
    throw new Error('Table does not have deletedAt field')
  }

  const condition = where
    ? and(where, isNull(deletedAtColumn))
    : isNull(deletedAtColumn)

  const result = await db.select().from(table).where(condition).limit(1)
  return result.length > 0
}
