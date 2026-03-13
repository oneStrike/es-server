import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { BadRequestException } from '@nestjs/common'
import { eq } from 'drizzle-orm'

function generateTemporaryValue(value1: unknown, value2: unknown): unknown {
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    const min = Math.min(value1, value2)
    return min - 1
  }

  if (typeof value1 === 'string' && typeof value2 === 'string') {
    return `__temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`
  }

  return Date.now()
}

export async function swapField(
  db: Db,
  table: PgTable<TableConfig>,
  options: {
    where: [{ id: number }, { id: number }]
    field?: string
    sourceField?: string
  },
): Promise<boolean> {
  const { where, field = 'sortOrder', sourceField } = options
  const tableAsAny = table as any
  const idColumn = tableAsAny.id
  if (!idColumn) {
    throw new BadRequestException('字段 "id" 不存在')
  }

  const fieldColumn = tableAsAny[field]
  if (!fieldColumn) {
    throw new BadRequestException(`字段 "${field}" 不存在`)
  }

  const sourceColumn = sourceField ? tableAsAny[sourceField] : null
  if (sourceField && !sourceColumn) {
    throw new BadRequestException(`字段 "${sourceField}" 不存在`)
  }

  return db.transaction(async (tx) => {
    const selectFields: Record<string, any> = { [field]: fieldColumn }
    if (sourceField && sourceColumn) {
      selectFields[sourceField] = sourceColumn
    }

    const [record1] = await tx
      .select(selectFields)
      .from(table)
      .where(eq(idColumn, where[0].id))
      .limit(1)
    const [record2] = await tx
      .select(selectFields)
      .from(table)
      .where(eq(idColumn, where[1].id))
      .limit(1)

    if (!record1 || !record2) {
      throw new BadRequestException('数据不存在')
    }

    if (
      sourceField &&
      record1[sourceField] !==
      record2[sourceField]
    ) {
      throw new BadRequestException('数据不是同一来源')
    }

    const value1 = record1[field]
    const value2 = record2[field]

    if (value1 === value2) {
      return true
    }

    const temporaryValue = generateTemporaryValue(value1, value2)

    await tx
      .update(table)
      .set({ [field]: temporaryValue } as any)
      .where(eq(idColumn, where[0].id))

    await tx
      .update(table)
      .set({ [field]: value1 } as any)
      .where(eq(idColumn, where[1].id))

    await tx
      .update(table)
      .set({ [field]: value2 } as any)
      .where(eq(idColumn, where[0].id))

    return true
  })
}
