import type { Db, PgTable, TableConfig } from '../core/drizzle.type'
import { BadRequestException } from '@nestjs/common'
import { eq } from 'drizzle-orm'

/**
 * 生成临时值用于字段交换
 * 根据值的类型生成一个不会与现有值冲突的临时值
 * @param value1 - 第一个值
 * @param value2 - 第二个值
 * @returns 临时值
 */
function generateTemporaryValue(value1: unknown, value2: unknown) {
  // 数值类型：取较小值减1作为临时值
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    const min = Math.min(value1, value2)
    return min - 1
  }

  // 字符串类型：生成带时间戳和随机数的临时字符串
  if (typeof value1 === 'string' && typeof value2 === 'string') {
    return `__temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`
  }

  // 其他类型：使用时间戳作为临时值
  return Date.now()
}

/**
 * 交换两条记录的指定字段值
 * 使用事务确保交换操作的原子性，通过临时值避免唯一约束冲突
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param options - 交换选项
 * @param options.where - 要交换的两条记录的 ID 条件
 * @param options.field - 要交换的字段名，默认为 'sortOrder'
 * @param options.sourceField - 来源字段名（可选），用于验证两条记录是否属于同一来源
 * @returns 交换成功返回 true
 * @throws BadRequestException - 当字段不存在、数据不存在或不是同一来源时抛出
 */
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

  // 验证必要字段是否存在
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

  // 在事务中执行交换操作
  return db.transaction(async (tx) => {
    // 构建查询字段
    const selectFields: Record<string, any> = { [field]: fieldColumn }
    if (sourceField && sourceColumn) {
      selectFields[sourceField] = sourceColumn
    }

    // 查询两条记录
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

    // 如果指定了来源字段，验证两条记录是否属于同一来源
    if (sourceField && record1[sourceField] !== record2[sourceField]) {
      throw new BadRequestException('数据不是同一来源')
    }

    const value1 = record1[field]
    const value2 = record2[field]

    // 值相同无需交换
    if (value1 === value2) {
      return true
    }

    // 生成临时值，用于避免唯一约束冲突
    const temporaryValue = generateTemporaryValue(value1, value2)

    // 三步交换法：
    // 1. 将第一条记录的值设为临时值
    await tx
      .update(table)
      .set({ [field]: temporaryValue } as any)
      .where(eq(idColumn, where[0].id))

    // 2. 将第二条记录的值设为第一条记录的原值
    await tx
      .update(table)
      .set({ [field]: value1 } as any)
      .where(eq(idColumn, where[1].id))

    // 3. 将第一条记录的值设为第二条记录的原值
    await tx
      .update(table)
      .set({ [field]: value2 } as any)
      .where(eq(idColumn, where[0].id))

    return true
  })
}
