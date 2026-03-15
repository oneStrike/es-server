import type { Db, PgTable, SQL, TableConfig } from '../drizzle.type'
import { NotFoundException } from '@nestjs/common'
import { and, gte, sql } from 'drizzle-orm'

/**
 * 应用计数器增量更新
 * 用于对指定字段进行原子性的增减操作，如点赞数、评论数等统计字段
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param where - 查询条件
 * @param field - 要更新的计数字段名
 * @param delta - 增量值（正数增加，负数减少）
 * @throws NotFoundException - 当字段不存在或目标记录不存在时抛出
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
  const tableAsAny = table as any
  const column = tableAsAny[field]
  if (!column) {
    throw new NotFoundException(`字段 "${field}" 不存在`)
  }

  // 正数增量：直接增加字段值
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

  // 负数增量：减少字段值，并确保不会减到负数
  // 使用 gte(column, amount) 条件保证计数器不会变成负数
  const amount = Math.abs(delta)
  await db
    .update(table)
    .set({ [field]: sql`${column} - ${amount}` } as any)
    .where(and(where, gte(column, amount)))
    .returning()
}

