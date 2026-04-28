import type { Db, PgTable, SQL, TableConfig } from '../core/drizzle.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { and, gte, sql } from 'drizzle-orm'

/**
 * 计数器增量失败原因码。
 * 统一通过 cause.code 透传给调用方，避免业务层再去匹配 message 文本。
 */
export const CountDeltaFailureCauseCode = {
  FIELD_NOT_FOUND: 'count_delta_field_not_found',
  TARGET_NOT_FOUND: 'count_delta_target_not_found',
  INSUFFICIENT_COUNT: 'count_delta_insufficient_count',
} as const

/**
 * 应用计数器增量更新
 * 用于对指定字段进行原子性的增减操作，如点赞数、评论数等统计字段
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param where - 查询条件
 * @param field - 要更新的计数字段名
 * @param delta - 增量值（正数增加，负数减少）
 * @throws BusinessException - 当字段不存在或目标记录不存在时抛出
 */
export async function applyCountDelta(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
  field: string,
  delta: number,
) {
  // 增量为0时无需操作，直接返回
  if (delta === 0) {
    return
  }

  // 获取目标字段，验证字段是否存在
  const column = Reflect.get(table as object, field) as SQL | undefined
  if (!column) {
    throw new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      `字段 "${field}" 不存在`,
      {
        cause: {
          code: CountDeltaFailureCauseCode.FIELD_NOT_FOUND,
        },
      },
    )
  }

  // 正数增量：直接增加字段值
  if (delta > 0) {
    const updated = await db
      .update(table)
      .set({ [field]: sql`${column} + ${delta}` } as Record<string, SQL>)
      .where(where)
      .returning()

    if (updated.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '目标不存在',
        {
          cause: {
            code: CountDeltaFailureCauseCode.TARGET_NOT_FOUND,
          },
        },
      )
    }
    return
  }

  // 负数增量：减少字段值，并确保不会减到负数
  // 使用 gte(column, amount) 条件保证计数器不会变成负数
  const amount = Math.abs(delta)
  const updated = await db
    .update(table)
    .set({ [field]: sql`${column} - ${amount}` } as Record<string, SQL>)
    .where(and(where, gte(column, amount)))
    .returning()

  if (updated.length === 0) {
    const existsRow = await db
      .select({ marker: sql<number>`1` })
      .from(table)
      .where(where)
      .limit(1)

    throw new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      existsRow.length > 0 ? '目标不存在或计数不足' : '目标不存在',
      {
        cause: {
          code:
            existsRow.length > 0
              ? CountDeltaFailureCauseCode.INSUFFICIENT_COUNT
              : CountDeltaFailureCauseCode.TARGET_NOT_FOUND,
        },
      },
    )
  }
}
