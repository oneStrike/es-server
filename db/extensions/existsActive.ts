import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { and, isNull } from 'drizzle-orm'

/**
 * 检查活跃记录是否存在（未软删除）
 * 查询表中是否存在符合条件的记录，且该记录未被软删除（deletedAt 为 null）
 * @param db - 数据库连接实例
 * @param table - 目标表，必须包含 deletedAt 字段
 * @param where - 查询条件（可选）
 * @returns 存在活跃记录返回 true，不存在返回 false
 * @throws Error - 当表不包含 deletedAt 字段时抛出
 */
export async function existsActive(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
): Promise<boolean> {
  // 获取 deletedAt 字段，验证表是否支持软删除
  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const deletedAtColumn = tableAsRecord.deletedAt

  if (!deletedAtColumn) {
    throw new Error('Table does not have deletedAt field')
  }

  // 构建查询条件：结合传入的条件和 deletedAt 为 null 的条件
  const condition = where
    ? and(where, isNull(deletedAtColumn))
    : isNull(deletedAtColumn)

  const result = await db
    .select()
    .from(table)
    .where(condition)
    .limit(1)
  return result.length > 0
}
