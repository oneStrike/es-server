import type {
  DbQueryConfig,
  DbQueryOrderBy,
  DbQueryOrderByRecord,
} from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { SQL } from '../drizzle.type'
import { DEFAULT_DB_QUERY_CONFIG } from '@libs/platform/config'
import { jsonParse } from '@libs/platform/utils'
import { BadRequestException } from '@nestjs/common'
import { asc, desc, getTableColumns } from 'drizzle-orm'

export interface DrizzlePageQueryInput {
  pageIndex?: number | string
  pageSize?: number | string
  orderBy?: unknown
}

export interface DrizzlePageQueryOptions<
  TTable extends AnyPgTable = AnyPgTable,
> {
  table?: TTable
  defaults?: Partial<DbQueryConfig>
  defaultPageIndex?: number
  defaultPageSize?: number
  defaultOrderBy?: DrizzlePageQueryInput['orderBy']
  maxPageSize?: number
}

export interface DrizzlePageQueryArgs {
  limit: number
  offset: number
  orderBy?: DbQueryOrderBy
}

export interface DrizzlePageQueryResult {
  pageIndex: number
  pageSize: number
  limit: number
  offset: number
  orderBy?: DbQueryOrderBy
  orderBySql: SQL[]
  args: DrizzlePageQueryArgs
}

function normalizeOrderDirection(value: unknown): 'asc' | 'desc' | undefined {
  if (value === 'asc' || value === 'desc') {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.toLowerCase()
  return normalized === 'asc' || normalized === 'desc' ? normalized : undefined
}

function parseOrderBy(
  value: DrizzlePageQueryInput['orderBy'],
): DbQueryOrderBy | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      return undefined
    }

    const parsed = jsonParse<DbQueryOrderBy>(value)
    if (!parsed) {
      throw new BadRequestException('orderBy 参数格式不合法')
    }

    return parsed
  }
  if (Array.isArray(value)) {
    return value as DbQueryOrderBy
  }
  if (typeof value === 'object') {
    return value as DbQueryOrderBy
  }

  throw new BadRequestException('orderBy 参数格式不合法')
}

function normalizePageIndex(
  value: DrizzlePageQueryInput['pageIndex'],
  fallback: number,
): number {
  const rawPageIndex = Number.isFinite(Number(value))
    ? Math.floor(Number(value))
    : fallback
  return Math.max(1, rawPageIndex)
}

function normalizeOrderBy(
  value: DrizzlePageQueryInput['orderBy'],
  validColumns?: Record<string, unknown>,
): DbQueryOrderBy | undefined {
  const parsed = parseOrderBy(value)
  if (!parsed) {
    return undefined
  }

  const records = Array.isArray(parsed) ? parsed : [parsed]
  const normalizedRecords: DbQueryOrderByRecord[] = []
  if (records.length === 0) {
    throw new BadRequestException('orderBy 不能为空')
  }

  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new BadRequestException('orderBy 参数格式不合法')
    }

    const entries = Object.entries(record)
    if (entries.length === 0) {
      throw new BadRequestException('orderBy 不能为空')
    }

    const normalizedRecord: DbQueryOrderByRecord = {}
    for (const [field, direction] of entries) {
      if (validColumns && !validColumns[field]) {
        throw new BadRequestException(`排序字段 "${field}" 不存在`)
      }

      const normalizedDirection = normalizeOrderDirection(direction)
      if (!normalizedDirection) {
        throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
      }

      normalizedRecord[field] = normalizedDirection
    }

    normalizedRecords.push(normalizedRecord)
  }

  return normalizedRecords.length === 1
    ? normalizedRecords[0]
    : normalizedRecords
}

function appendStableIdOrderBy(
  orderBy: DbQueryOrderBy | undefined,
  validColumns?: Record<string, unknown>,
): DbQueryOrderBy | undefined {
  if (!orderBy || !validColumns?.id) {
    return orderBy
  }

  const records = Array.isArray(orderBy) ? [...orderBy] : [orderBy]
  if (records.some((record) => Object.hasOwn(record, 'id'))) {
    return orderBy
  }

  let idDirection: 'asc' | 'desc' = 'desc'
  for (
    let recordIndex = records.length - 1;
    recordIndex >= 0;
    recordIndex -= 1
  ) {
    const directions = Object.values(records[recordIndex])
    const lastDirection = directions.at(-1)
    if (lastDirection === 'asc' || lastDirection === 'desc') {
      idDirection = lastDirection
      break
    }
  }

  return [...records, { id: idDirection }]
}

function buildOrderBySql(
  orderBy: DbQueryOrderBy | undefined,
  validColumns?: Record<string, unknown>,
): SQL[] {
  if (!orderBy || !validColumns) {
    return []
  }

  const records = Array.isArray(orderBy) ? orderBy : [orderBy]
  const orderBySql: SQL[] = []

  for (const record of records) {
    for (const [field, direction] of Object.entries(record)) {
      const column = validColumns[field]
      if (!column) {
        continue
      }

      orderBySql.push(
        direction === 'asc' ? asc(column as never) : desc(column as never),
      )
    }
  }

  return orderBySql
}

export function buildDrizzlePageQuery<TTable extends AnyPgTable = AnyPgTable>(
  input: DrizzlePageQueryInput = {},
  options: DrizzlePageQueryOptions<TTable> = {},
): DrizzlePageQueryResult {
  const resolvedDefaults: DbQueryConfig = {
    ...DEFAULT_DB_QUERY_CONFIG,
    ...options.defaults,
    pageIndex:
      options.defaultPageIndex ??
      options.defaults?.pageIndex ??
      DEFAULT_DB_QUERY_CONFIG.pageIndex,
    pageSize:
      options.defaultPageSize ??
      options.defaults?.pageSize ??
      DEFAULT_DB_QUERY_CONFIG.pageSize,
    orderBy: options.defaults?.orderBy ?? DEFAULT_DB_QUERY_CONFIG.orderBy,
  }
  const pageIndex = normalizePageIndex(
    input.pageIndex,
    resolvedDefaults.pageIndex,
  )
  const rawPageSize = Number.isFinite(Number(input.pageSize))
    ? Math.floor(Number(input.pageSize))
    : resolvedDefaults.pageSize
  const resolvedMaxPageSize = Number.isFinite(Number(options.maxPageSize))
    ? Math.max(1, Math.floor(Number(options.maxPageSize)))
    : resolvedDefaults.maxListItemLimit
  const pageSize = Math.min(Math.max(1, rawPageSize), resolvedMaxPageSize)
  // 对外分页契约统一使用 1-based 页码，数据库 offset 仍然从 0 开始。
  const offset = (pageIndex - 1) * pageSize
  const validColumns = options.table
    ? (getTableColumns(options.table) as Record<string, unknown>)
    : undefined
  let orderBy = normalizeOrderBy(
    input.orderBy ?? options.defaultOrderBy ?? resolvedDefaults.orderBy,
    validColumns,
  )

  if (!orderBy && validColumns?.id) {
    orderBy = { id: 'desc' }
  }
  orderBy = appendStableIdOrderBy(orderBy, validColumns)

  const orderBySql = buildOrderBySql(orderBy, validColumns)
  const args: DrizzlePageQueryArgs = {
    limit: pageSize,
    offset,
    ...(orderBy ? { orderBy } : {}),
  }

  return {
    pageIndex,
    pageSize,
    limit: pageSize,
    offset,
    orderBy,
    orderBySql,
    args,
  }
}
