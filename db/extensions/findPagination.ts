import type { InferSelectModel } from 'drizzle-orm'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { DbQueryConfig, DbQueryOrderBy } from '@libs/platform/config'
import type { Db, SQL } from '../core/drizzle.type'
import { buildDrizzlePageQuery } from '../core/query/page-query'
import { getTableColumns } from 'drizzle-orm'

type FindPaginationOrderBy = DbQueryOrderBy | string

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

type FindPaginationResultItem<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[],
  TPick extends readonly (keyof InferSelectModel<TTable> & string)[],
> = TPick extends []
  ? Omit<InferSelectModel<TTable>, TOmit[number]>
  : Pick<InferSelectModel<TTable>, TPick[number]>

export async function findPagination<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
  TPick extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
>(
  db: Db,
  table: TTable,
  options: FindPaginationOptions<TTable, TOmit, TPick> = {},
  queryConfig?: DbQueryConfig,
): Promise<{
  list: FindPaginationResultItem<TTable, TOmit, TPick>[]
  total: number
  pageIndex: number
  pageSize: number
}> {
  const { where, pageIndex, pageSize, orderBy, omit, pick } = options
  const pageQuery = buildDrizzlePageQuery(
    { pageIndex, pageSize, orderBy },
    {
      table,
      defaults: queryConfig,
    },
  )

  const omittedFields = new Set<string>(omit ?? [])
  const pickedFields = new Set<string>(pick ?? [])
  if (omittedFields.size > 0 && pickedFields.size > 0) {
    throw new Error('不支持pick和omit同时使用')
  }
  const hasPick = pickedFields.size > 0
  const tableColumns = getTableColumns(table as any) as Record<string, unknown>
  const selectedColumns = Object.fromEntries(
    Object.entries(tableColumns).filter(([key]) =>
      hasPick ? pickedFields.has(key) : !omittedFields.has(key),
    ),
  )
  const baseQuery =
    !hasPick && Object.keys(selectedColumns).length === 0
      ? db.select().from(table as AnyPgTable)
      : Object.keys(selectedColumns).length > 0
      ? db.select(selectedColumns as any).from(table as AnyPgTable)
      : (() => {
          throw new Error('findPagination options.pick has no valid fields')
        })()
  const listQuery = baseQuery
    .where(where)
    .limit(pageQuery.limit)
    .offset(pageQuery.offset)
  const [list, countResult] = await Promise.all([
    pageQuery.orderBySql.length > 0
      ? listQuery.orderBy(...pageQuery.orderBySql)
      : listQuery,
    db.$count(table as AnyPgTable, where),
  ])

  return {
    list: list as FindPaginationResultItem<TTable, TOmit, TPick>[],
    total: countResult,
    pageIndex: pageQuery.pageIndex,
    pageSize: pageQuery.pageSize,
  }
}
