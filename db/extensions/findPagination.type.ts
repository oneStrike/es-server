import type { DbQueryOrderBy } from '@libs/platform/config'
import type { InferSelectModel } from 'drizzle-orm'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { SQL } from '../core/drizzle.type'

/**
 * 分页扩展支持的排序输入。
 */
export type FindPaginationOrderBy = DbQueryOrderBy | string

/**
 * 单表分页扩展的查询参数。
 */
export interface FindPaginationOptions<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
  TPick extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
> {
  where?: SQL
  pageIndex?: number | string
  pageSize?: number | string
  orderBy?: FindPaginationOrderBy
  omit?: TOmit
  pick?: TPick
}

/**
 * 根据 pick / omit 选项推导出的分页行类型。
 */
export type FindPaginationResultItem<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[],
  TPick extends readonly (keyof InferSelectModel<TTable> & string)[],
> = TPick extends []
  ? Omit<InferSelectModel<TTable>, TOmit[number]>
  : Pick<InferSelectModel<TTable>, TPick[number]>
