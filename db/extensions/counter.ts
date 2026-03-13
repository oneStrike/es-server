import type { SQL } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { NotFoundException } from '@nestjs/common'
import { and, gte, sql } from 'drizzle-orm'

export async function applyCountDelta(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
  field: string,
  delta: number,
) {
  if (delta === 0) {
    return
  }

  const tableAsAny = table as any
  const column = tableAsAny[field]
  if (!column) {
    throw new NotFoundException(`字段 "${field}" 不存在`)
  }

  if (delta > 0) {
    const updated = await db
      .update(table)
      .set({ [field]: sql`${column} + ${delta}` } as any)
      .where(where)
      .returning()

    if (updated.length === 0) {
      throw new NotFoundException('目标不存在')
    }
    return
  }

  const amount = Math.abs(delta)
  await db
    .update(table)
    .set({ [field]: sql`${column} - ${amount}` } as any)
    .where(and(where, gte(column, amount)))
    .returning()
}
