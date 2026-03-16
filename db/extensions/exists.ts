import type { Db, PgTable, SQL, TableConfig } from '../core/drizzle.type'

/**
 * 检查记录是否存在
 * 根据指定条件查询表中是否存在符合条件的记录
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param where - 查询条件（可选）
 * @returns 存在返回 true，不存在返回 false
 */
export async function exists(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
): Promise<boolean> {
  const result = await db.select().from(table).where(where).limit(1)
  return result.length > 0
}
