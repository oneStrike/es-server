import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export interface NormalizedPagination {
  pageIndex: number
  pageSize: number
  skip: number
  take: number
}

export function normalizeInteractionPagination(
  pageIndex?: number,
  pageSize?: number,
): NormalizedPagination {
  const rawPageIndex = Number.isFinite(Number(pageIndex))
    ? Math.floor(Number(pageIndex))
    : 1
  const normalizedPageIndex = Math.max(1, rawPageIndex)

  const rawPageSize = Number.isFinite(Number(pageSize))
    ? Math.floor(Number(pageSize))
    : 15
  const normalizedPageSize = Math.min(Math.max(1, rawPageSize), 500)

  const skip = (normalizedPageIndex - 1) * normalizedPageSize

  return {
    pageIndex: normalizedPageIndex,
    pageSize: normalizedPageSize,
    skip,
    take: normalizedPageSize,
  }
}

export type CreatedAtColumn = 'udr.created_at' | 'upr.created_at'

export function buildCreatedAtSqlFilter(
  column: CreatedAtColumn,
  startDate?: string,
  endDate?: string,
) {
  const filters: SQL[] = []
  const columnRef = sql.raw(column)

  if (startDate) {
    const start = new Date(startDate)
    if (!Number.isNaN(start.getTime())) {
      filters.push(sql`${columnRef} >= ${start}`)
    }
  }

  if (endDate) {
    const end = new Date(endDate)
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1)
      filters.push(sql`${columnRef} < ${end}`)
    }
  }

  if (filters.length === 0) {
    return sql.empty()
  }

  return sql` AND ${sql.join(filters, sql` AND `)}`
}
