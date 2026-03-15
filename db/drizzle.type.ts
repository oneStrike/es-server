import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from './relations'
import type * as schema from './schema'

export type Db = NodePgDatabase<typeof schema, typeof relations>

export type DrizzleSql = SQL

export type { PgTable }

export type { SQL, SQLWrapper, TableConfig }

export type DrizzleWhere = SQL | undefined

export type DrizzleColumnKey<TTable extends PgTable> =
  keyof TTable['_']['columns'] & string

export interface DrizzleWhereOptions<
  TTable extends PgTable,
  TData extends object = Record<string, unknown>,
> {
  /** 等值匹配字段列表 */
  eq?: DrizzleColumnKey<TTable>[]
  /** 模糊匹配字段列表（ILIKE %value%） */
  like?: DrizzleColumnKey<TTable>[]
  /** IN 查询字段列表（数组值） */
  inArray?: DrizzleColumnKey<TTable>[]
  /** 大于等于字段列表 [字段名, 值字段名] */
  gte?: [DrizzleColumnKey<TTable>, keyof TData & string][]
  /** 小于等于字段列表 [字段名, 值字段名] */
  lte?: [DrizzleColumnKey<TTable>, keyof TData & string][]
  /** BETWEEN 查询字段列表 [字段名, 起始值字段名, 结束值字段名]，允许降级到 gte/lte */
  between?: [DrizzleColumnKey<TTable>, keyof TData & string, keyof TData & string][]
  /** IS NULL 查询字段列表 */
  isNull?: DrizzleColumnKey<TTable>[]
}
