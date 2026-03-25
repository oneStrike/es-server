import type { DbQueryConfig, DbQueryOrderBy } from '@libs/platform/config'
import type { InferSelectModel } from 'drizzle-orm'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { Db, SQL } from '../core/drizzle.type'
import { BadRequestException } from '@nestjs/common'
import { getTableColumns } from 'drizzle-orm'
import { buildDrizzlePageQuery } from '../core/query/page-query'

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
    throw new BadRequestException('不支持 pick 和 omit 同时使用')
  }
  const hasPick = pickedFields.size > 0
  const tableColumns = getTableColumns(table as any) as Record<string, unknown>
  const invalidPickedFields = [...pickedFields].filter(field => !tableColumns[field])
  if (invalidPickedFields.length > 0) {
    throw new BadRequestException(
      `pick 字段不存在: ${invalidPickedFields.join(', ')}`,
    )
  }

  const invalidOmittedFields = [...omittedFields].filter(field => !tableColumns[field])
  if (invalidOmittedFields.length > 0) {
    throw new BadRequestException(
      `omit 字段不存在: ${invalidOmittedFields.join(', ')}`,
    )
  }

  const selectedColumns = Object.fromEntries(
    Object.entries(tableColumns).filter(([key]) =>
      hasPick ? pickedFields.has(key) : !omittedFields.has(key),
    ),
  )
  const selectedColumnCount = Object.keys(selectedColumns).length
  if (hasPick && selectedColumnCount === 0) {
    throw new BadRequestException('findPagination options.pick has no valid fields')
  }
  if (omittedFields.size > 0 && selectedColumnCount === 0) {
    throw new BadRequestException(
      'findPagination options.omit removes all selectable fields',
    )
  }

  const baseQuery =
    !hasPick && omittedFields.size === 0
      ? db.select().from(table as AnyPgTable)
      : selectedColumnCount > 0
      ? db.select(selectedColumns as any).from(table as AnyPgTable)
      : (() => {
          throw new BadRequestException('findPagination options.pick has no valid fields')
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
