import type { SQL } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { desc } from 'drizzle-orm'

export async function maxOrder(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
  field: string = 'sortOrder',
): Promise<number> {
  const tableAsAny = table as any
  const column = tableAsAny[field]
  if (!column) {
    return 0
  }

  const [result] = await db
    .select({ value: column })
    .from(table)
    .where(where)
    .orderBy(desc(column))
    .limit(1)

  return typeof result?.value === 'number' ? result.value : 0
}
