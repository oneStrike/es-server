import type { Db, PgTable, TableConfig } from '../core/drizzle.type'
import type { SwapFieldOptions } from './swapField.type'
import { randomUUID } from 'node:crypto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { InternalServerErrorException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

/**
 * 生成临时值用于字段交换
 * 根据值的类型生成一个不会与现有值冲突的临时值
 * @param value1 - 第一个值
 * @param value2 - 第二个值
 * @returns 临时值
 */
function generateTemporaryValue(
  value1: string | number | null | undefined,
  value2: string | number | null | undefined,
) {
  // 数值类型：取较小值减1作为临时值
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    const min = Math.min(value1, value2)
    return min - 1
  }

  // 字符串类型：生成带时间戳和随机数的临时字符串
  if (typeof value1 === 'string' && typeof value2 === 'string') {
    return `__temp_${Date.now()}_${randomUUID()}__`
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
 * @param options.recordWhere - 附加到两条记录查询/更新上的共享过滤条件
 * @returns 交换成功返回 true
 * @throws BadRequestException - 当字段不存在、数据不存在或不是同一来源时抛出
 */
export async function swapField(
  db: Db,
  table: PgTable<TableConfig>,
  options: SwapFieldOptions,
): Promise<boolean> {
  const { where, field = 'sortOrder', sourceField, recordWhere } = options
  const tableRef = table as object

  // 验证必要字段是否存在
  const idColumn = Reflect.get(tableRef, 'id')
  if (!idColumn) {
    throw new InternalServerErrorException('字段 "id" 不存在')
  }

  const fieldColumn = Reflect.get(tableRef, field)
  if (!fieldColumn) {
    throw new InternalServerErrorException(`字段 "${field}" 不存在`)
  }

  const sourceColumn = sourceField ? Reflect.get(tableRef, sourceField) : null
  if (sourceField && !sourceColumn) {
    throw new InternalServerErrorException(`字段 "${sourceField}" 不存在`)
  }

  const buildRecordWhere = (id: number) =>
    recordWhere
      ? and(eq(idColumn as never, id), recordWhere)!
      : eq(idColumn as never, id)

  // 在事务中执行交换操作
  return db.transaction(async (tx) => {
    // 构建查询字段
    const selectFields: Record<string, object> = {
      [field]: fieldColumn as object,
    }
    if (sourceField && sourceColumn) {
      selectFields[sourceField] = sourceColumn as object
    }

    // 查询两条记录
    const [record1] = await tx
      .select(selectFields as never)
      .from(table)
      .where(buildRecordWhere(where[0].id) as never)
      .limit(1)
    const [record2] = await tx
      .select(selectFields as never)
      .from(table)
      .where(buildRecordWhere(where[1].id) as never)
      .limit(1)

    if (!record1 || !record2) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '数据不存在',
      )
    }

    // 如果指定了来源字段，验证两条记录是否属于同一来源
    if (sourceField && record1[sourceField] !== record2[sourceField]) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '数据不是同一来源',
      )
    }

    const value1 = record1[field] as string | number | null | undefined
    const value2 = record2[field] as string | number | null | undefined

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
      .set({ [field]: temporaryValue } as never)
      .where(buildRecordWhere(where[0].id) as never)

    // 2. 将第二条记录的值设为第一条记录的原值
    await tx
      .update(table)
      .set({ [field]: value1 } as never)
      .where(buildRecordWhere(where[1].id) as never)

    // 3. 将第一条记录的值设为第二条记录的原值
    await tx
      .update(table)
      .set({ [field]: value2 } as never)
      .where(buildRecordWhere(where[0].id) as never)

    return true
  })
}
