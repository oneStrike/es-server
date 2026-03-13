import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { DbConfig } from '@libs/base/config'
import { jsonParse } from '@libs/base/utils'
import { and, asc, desc, gte, lt, sql } from 'drizzle-orm'

type OrderByValue = 'asc' | 'desc' | 'ASC' | 'DESC' | string
type OrderByRecord = Record<string, OrderByValue>
type OrderByInput = OrderByRecord | OrderByRecord[] | string | null | undefined

interface FindPaginationOptions {
  where?: SQL
  pageIndex?: number | string
  pageSize?: number | string
  startDate?: string | Date
  endDate?: string | Date
  orderBy?: OrderByInput
  dateColumn?: string
}

function normalizeDirection(value: unknown): 'asc' | 'desc' | null {
  if (typeof value !== 'string') {
    return null
  }
  const lower = value.toLowerCase()
  if (lower === 'asc' || lower === 'desc') {
    return lower
  }
  return null
}

function normalizeOrderBy(
  table: PgTable<TableConfig>,
  orderByInput: OrderByInput,
): SQL[] | undefined {
  const tableAsAny = table as any
  const parsed =
    typeof orderByInput === 'string'
      ? (jsonParse(orderByInput) as OrderByInput)
      : orderByInput

  const records: OrderByRecord[] = []

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        records.push(item)
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    records.push(parsed)
  }

  if (records.length === 0) {
    return undefined
  }

  const orderBy: SQL[] = []
  for (const record of records) {
    for (const [field, direction] of Object.entries(record)) {
      const column = tableAsAny[field]
      if (!column) {
        continue
      }
      const normalized = normalizeDirection(direction)
      if (!normalized) {
        continue
      }
      orderBy.push(normalized === 'asc' ? asc(column) : desc(column))
    }
  }

  return orderBy.length > 0 ? orderBy : undefined
}

function toDate(value: string | Date | undefined): Date | null {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
  const {
    where,
    pageIndex,
    pageSize,
    startDate,
    endDate,
    orderBy,
    dateColumn = 'createdAt',
  } = options

  const rawPageIndex = Number.isFinite(Number(pageIndex))
    ? Math.floor(Number(pageIndex))
    : DbConfig.query.pageIndex
  const normalizedPageIndex =
    rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)
  const normalizedPageSizeBase = Number.isFinite(Number(pageSize))
    ? Math.floor(Number(pageSize))
    : DbConfig.query.pageSize
  const normalizedPageSize = Math.min(
    Math.max(1, normalizedPageSizeBase),
    DbConfig.query.maxListItemLimit,
  )

  const offset =
    normalizedPageIndex >= 1
      ? (normalizedPageIndex - 1) * normalizedPageSize
      : normalizedPageIndex * normalizedPageSize

  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const dateColumnRef = tableAsRecord[dateColumn]

  let dateCondition: SQL | undefined
  const start = toDate(startDate)
  const end = toDate(endDate)
  if (dateColumnRef && (start || end)) {
    const conditions: SQL[] = []
    if (start) {
      conditions.push(gte(dateColumnRef, start))
    }
    if (end) {
      const endDateValue = new Date(end)
      endDateValue.setDate(endDateValue.getDate() + 1)
      conditions.push(lt(dateColumnRef, endDateValue))
    }
    if (conditions.length > 0) {
      dateCondition =
        conditions.length === 1 ? conditions[0] : and(...conditions)
    }
  }

  const finalWhere =
    where && dateCondition
      ? and(where, dateCondition)
      : (where ?? dateCondition)

  const resolvedOrderBy =
    normalizeOrderBy(table, orderBy) ||
    normalizeOrderBy(table, DbConfig.query.orderBy)

  const [list, countResult] = await Promise.all([
    resolvedOrderBy && resolvedOrderBy.length > 0
      ? db
          .select()
          .from(table)
          .where(finalWhere)
          .limit(normalizedPageSize)
          .offset(offset)
          .orderBy(...resolvedOrderBy)
      : db
          .select()
          .from(table)
          .where(finalWhere)
          .limit(normalizedPageSize)
          .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(finalWhere),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  return {
    list,
    total,
    pageIndex: normalizedPageIndex,
    pageSize: normalizedPageSize,
  }
}
