import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { Db, SQL } from '../core/drizzle.type'
import { desc, getColumnTable } from 'drizzle-orm'

/**
 * 获取指定列的最大值。
 * 通过直接传入列引用避免字符串字段名漂移，未命中记录时返回 0 作为“空范围”的追加起点。
 * @param db - 数据库连接实例
 * @param options - 查询参数
 * @param options.column - 目标排序列
 * @param options.where - 可选的范围条件
 * @returns 列的最大值；无记录时返回 0
 */
export async function maxOrder(
  db: Db,
  options: {
    column: AnyPgColumn
    where?: SQL
  },
): Promise<number> {
  const { column, where } = options
  const table = getColumnTable(column)

  // 按列降序取首行，兼容空范围直接返回 0。
  const [result] = await db
    .select({ value: column })
    .from(table)
    .where(where)
    .orderBy(desc(column))
    .limit(1)

  return typeof result?.value === 'number' ? result.value : 0
}
