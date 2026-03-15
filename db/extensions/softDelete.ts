import type {
  Db,
  PgTable,
  SQL,
  SQLWrapper,
  TableConfig,
} from '../drizzle.type'
import { BadRequestException } from '@nestjs/common'
import { and, isNull } from 'drizzle-orm'

/**
 * 获取表的 deletedAt 字段
 * @param table - 目标表
 * @returns deletedAt 字段引用
 * @throws Error - 当表不包含 deletedAt 字段时抛出
 */
function getDeletedAtColumn(table: PgTable<TableConfig>): SQLWrapper {
  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const deletedAtColumn = tableAsRecord.deletedAt
  if (!deletedAtColumn) {
    throw new Error('Table does not have deletedAt field')
  }
  return deletedAtColumn
}

/**
 * 单条记录软删除
 * 将符合条件的未删除记录的 deletedAt 字段设置为当前时间
 * @param db - 数据库连接实例
 * @param table - 目标表，必须包含 deletedAt 字段
 * @param where - 删除条件
 * @returns 更新后的记录
 * @throws BadRequestException - 当数据不存在或已被删除时抛出
 */
export async function softDelete(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
) {
  const deletedAtColumn = getDeletedAtColumn(table)
  // 确保只删除未删除的记录（deletedAt 为 null）
  const condition = and(where, isNull(deletedAtColumn))

  // 先查询确认记录存在且未删除
  const [target] = await db
    .select()
    .from(table)
    .where(condition)
    .limit(1)

  if (!target) {
    throw new BadRequestException('删除失败：数据不存在')
  }

  // 执行软删除，设置 deletedAt 为当前时间
  const [updated] = await db
    .update(table)
    .set({ deletedAt: new Date() } as any)
    .where(condition)
    .returning()

  return updated
}

/**
 * 批量软删除
 * 将符合条件的所有未删除记录的 deletedAt 字段设置为当前时间
 * @param db - 数据库连接实例
 * @param table - 目标表，必须包含 deletedAt 字段
 * @param where - 删除条件
 * @returns 实际删除的记录数量
 */
export async function softDeleteMany(
  db: Db,
  table: PgTable<TableConfig>,
  where: SQL,
): Promise<number> {
  const deletedAtColumn = getDeletedAtColumn(table)
  // 确保只删除未删除的记录（deletedAt 为 null）
  const condition = and(where, isNull(deletedAtColumn))

  const result = await db
    .update(table)
    .set({ deletedAt: new Date() } as any)
    .where(condition)
    .returning()

  return result.length
}

