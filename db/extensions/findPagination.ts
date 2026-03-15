import type { Db, PgTable, SQL, TableConfig } from '../drizzle.type'
import { DbConfig } from '@libs/platform/config'
import { asc, desc, } from 'drizzle-orm'

interface FindPaginationOptions {
  where?: SQL
  pageIndex?: number | string
  pageSize?: number | string
  orderBy?: string
}

export async function findPagination(
  db: Db,
  table: PgTable<TableConfig>,
  options: FindPaginationOptions = {},
): Promise<{
  list: unknown[]
  total: number
  pageIndex: number
  pageSize: number
}> {
  const { where, pageIndex, pageSize, orderBy } = options
  const tableAsAny = table as any

  const pageIndexValue = Number(pageIndex) || DbConfig.query.pageIndex
  const pageSizeValue = Math.min(
    Math.max(1, Number(pageSize) || DbConfig.query.pageSize),
    DbConfig.query.maxListItemLimit,
  )
  const offset = Math.max(0, pageIndexValue - 1) * pageSizeValue

  const orderBySql: SQL[] = []
  if (orderBy) {
    const records = Array.isArray(orderBy) ? orderBy : [orderBy]
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

  const [list, countResult] = await Promise.all([
    db
      .select()
      .from(table)
      .where(where)
      .limit(pageSizeValue)
      .offset(offset)
      .orderBy(...orderBySql),
    db.$count(table, where),
  ])

  return {
    list,
    total: Number(countResult[0]?.count ?? 0),
    pageIndex: pageIndexValue,
    pageSize: pageSizeValue,
  }
}
