import type { InferSelectModel } from 'drizzle-orm'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { Db, SQL } from '../core/drizzle.type'
import { DbConfig } from '@libs/platform/config'
import { jsonParse } from '@libs/platform/utils'
import { asc, desc } from 'drizzle-orm'

type FindPaginationOrderByRecord = Record<string, 'asc' | 'desc'>
type FindPaginationOrderBy =
  | FindPaginationOrderByRecord
  | FindPaginationOrderByRecord[]
  | string

export interface FindPaginationOptions<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
> {
  where?: SQL
  pageIndex?: number | string
  pageSize?: number | string
  orderBy?: FindPaginationOrderBy
  omit?: TOmit
}

export async function findPagination<
  TTable extends AnyPgTable,
  TOmit extends readonly (keyof InferSelectModel<TTable> & string)[] = [],
>(
  db: Db,
  table: TTable,
  options: FindPaginationOptions<TTable, TOmit> = {},
): Promise<{
  list: Omit<InferSelectModel<TTable>, TOmit[number]>[]
  total: number
  pageIndex: number
  pageSize: number
}> {
  const { where, pageIndex, pageSize, orderBy, omit } = options
  const tableAsAny = table as any

  const rawPageIndex = Number.isFinite(Number(pageIndex))
    ? Math.floor(Number(pageIndex))
    : DbConfig.query.pageIndex
  const normalizedPageIndex =
    rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)
  const rawPageSize = Number.isFinite(Number(pageSize))
    ? Math.floor(Number(pageSize))
    : DbConfig.query.pageSize
  const normalizedPageSize = Math.min(
    Math.max(1, rawPageSize),
    DbConfig.query.maxListItemLimit,
  )
  const skip = Math.max(
    0,
    normalizedPageIndex >= 1
      ? (normalizedPageIndex - 1) * normalizedPageSize
      : normalizedPageIndex * normalizedPageSize,
  )
  const take = normalizedPageSize

  const orderBySql: SQL[] = []
  const resolvedOrderBy = orderBy ?? DbConfig?.query.orderBy
  const parsedOrderBy =
    typeof resolvedOrderBy === 'string'
      ? jsonParse<FindPaginationOrderBy>(resolvedOrderBy)
      : resolvedOrderBy
  if (parsedOrderBy) {
    const records = Array.isArray(parsedOrderBy)
      ? parsedOrderBy
      : [parsedOrderBy]
    for (const record of records) {
      for (const [field, direction] of Object.entries(record)) {
        const column = tableAsAny[field]
        if (column) {
          orderBySql.push(direction === 'asc' ? asc(column) : desc(column))
        }
      }
    }
  }
  if (orderBySql.length === 0 && tableAsAny.id) {
    orderBySql.push(desc(tableAsAny.id))
  }

  const omittedFields = new Set<string>(omit ?? [])
  const tableColumns = (tableAsAny._?.columns ?? {}) as Record<string, unknown>
  const selectedColumns = Object.fromEntries(
    Object.entries(tableColumns).filter(([key]) => !omittedFields.has(key)),
  )
  const baseQuery =
    Object.keys(selectedColumns).length > 0
      ? db.select(selectedColumns as any).from(table as AnyPgTable)
      : db.select().from(table as AnyPgTable)
  const [list, countResult] = await Promise.all([
    baseQuery
      .where(where)
      .limit(take)
      .offset(skip)
      .orderBy(...orderBySql),
    db.$count(table as AnyPgTable, where),
  ])

  return {
    list: list as Omit<InferSelectModel<TTable>, TOmit[number]>[],
    total: countResult,
    pageIndex: normalizedPageIndex,
    pageSize: normalizedPageSize,
  }
}
