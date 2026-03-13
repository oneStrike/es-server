import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { BadRequestException } from '@nestjs/common'
import { and, isNull } from 'drizzle-orm'

function getDeletedAtColumn(table: PgTable<TableConfig>): SQLWrapper {
  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const deletedAtColumn = tableAsRecord.deletedAt
  if (!deletedAtColumn) {
    throw new Error('Table does not have deletedAt field')
  }
  return deletedAtColumn
}

export async function softDelete(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
) {
  const deletedAtColumn = getDeletedAtColumn(table)
  const condition = and(where, isNull(deletedAtColumn))

  const [target] = await db
    .select()
    .from(table)
    .where(condition)
    .limit(1)

  if (!target) {
    throw new BadRequestException('删除失败：数据不存在')
  }

  const [updated] = await db
    .update(table)
    .set({ deletedAt: new Date() } as any)
    .where(condition)
    .returning()

  return updated
}

export async function softDeleteMany(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
): Promise<number> {
  const deletedAtColumn = getDeletedAtColumn(table)
  const condition = and(where, isNull(deletedAtColumn))

  const result = await db
    .update(table)
    .set({ deletedAt: new Date() } as any)
    .where(condition)
    .returning()

  return result.length
}
