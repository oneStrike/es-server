import type { Db, PgTable, SQL, TableConfig } from '../core/drizzle.type'
import { desc } from 'drizzle-orm'

/**
 * 获取指定字段的最大值
 * 常用于获取排序字段的最大值，以便计算新记录的排序值
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param where - 查询条件（可选）
 * @param field - 要查询的字段名，默认为 'sortOrder'
 * @returns 字段的最大值，无记录或字段不存在时返回 0
 */
export async function maxOrder(
  db: Db,
  table: PgTable<TableConfig>,
  where?: SQL,
  field: string = 'sortOrder',
): Promise<number> {
  const tableAsAny = table as any
  const column = tableAsAny[field]
  if (!column) {
    return 0
  }

  // 按字段降序排列，取第一条记录即为最大值
  const [result] = await db
    .select({ value: column })
    .from(table)
    .where(where)
    .orderBy(desc(column))
    .limit(1)

  return typeof result?.value === 'number' ? result.value : 0
}
