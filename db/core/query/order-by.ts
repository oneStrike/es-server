import type {
  DbQueryOrderBy,
  DbQueryOrderByRecord,
} from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { SQL } from '../drizzle.type'
import { jsonParse } from '@libs/platform/utils/jsonParse'
import { BadRequestException } from '@nestjs/common'
import { asc, desc, getColumns } from 'drizzle-orm'

export interface DrizzleOrderByOptions<TTable extends AnyPgTable = AnyPgTable> {
  table?: TTable
  fallbackOrderBy?: unknown
}

export type DrizzleRelationOrderBy = DbQueryOrderByRecord

/**
 * 归一化排序方向，避免上层在分页、列表和单条查询场景里各自维护大小写兼容。
 */
function normalizeOrderDirection(value: unknown) {
  if (value === 'asc' || value === 'desc') {
    return value
  }
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.toLowerCase()
  return normalized === 'asc' || normalized === 'desc' ? normalized : undefined
}

/**
 * 解析外部传入的 orderBy，兼容 query string JSON 和对象两种入口。
 */
function parseOrderBy(value: unknown) {
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

/**
 * 在进入 SQL 构造前校验排序字段和方向，并统一收敛为有序记录列表。
 * 这样既能兼容外部数组写法，也能在后续同时生成 RQB v2 和 select 两套输出。
 */
function normalizeOrderByRecords(
  value: unknown,
  validColumns?: Record<string, unknown>,
): DbQueryOrderByRecord[] | undefined {
  const parsed = parseOrderBy(value)
  if (!parsed) {
    return undefined
  }

  const records = Array.isArray(parsed) ? parsed : [parsed]
  const normalizedRecords: DbQueryOrderByRecord[] = []
  const seenFields = new Set<string>()
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
      if (seenFields.has(field)) {
        throw new BadRequestException(`排序字段 "${field}" 重复`)
      }

      const normalizedDirection = normalizeOrderDirection(direction)
      if (!normalizedDirection) {
        throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
      }

      normalizedRecord[field] = normalizedDirection
      seenFields.add(field)
    }

    normalizedRecords.push(normalizedRecord)
  }

  return normalizedRecords
}

/**
 * 为非唯一排序自动补上 id 决胜字段，避免分页和“取第一条”在并列值下出现不稳定结果。
 */
function appendStableIdOrderBy(
  orderByRecords: DbQueryOrderByRecord[] | undefined,
  validColumns?: Record<string, unknown>,
): DbQueryOrderByRecord[] | undefined {
  if (!orderByRecords || !validColumns?.id) {
    return orderByRecords
  }

  const records = [...orderByRecords]
  if (records.some((record) => Object.hasOwn(record, 'id'))) {
    return orderByRecords
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

/**
 * 将有序记录列表合并为 RQB v2 期望的单对象排序定义。
 */
function buildRelationOrderBy(
  orderByRecords: DbQueryOrderByRecord[] | undefined,
) {
  if (!orderByRecords || orderByRecords.length === 0) {
    return undefined
  }

  const orderBy: DrizzleRelationOrderBy = {}
  for (const record of orderByRecords) {
    for (const [field, direction] of Object.entries(record)) {
      orderBy[field] = direction
    }
  }

  return orderBy
}

/**
 * 将统一后的关系查询排序对象转换为 Drizzle core query 可执行的 SQL[]。
 */
export function buildOrderBySql(
  orderBy: DrizzleRelationOrderBy | undefined,
  validColumns?: Record<string, unknown>,
): SQL[] {
  if (!orderBy || !validColumns) {
    return []
  }

  const orderBySql: SQL[] = []

  for (const [field, direction] of Object.entries(orderBy)) {
    const column = validColumns[field]
    if (!column) {
      continue
    }

    orderBySql.push(
      direction === 'asc' ? asc(column as never) : desc(column as never),
    )
  }

  return orderBySql
}

/**
 * 统一构建可同时用于 RQB v2 和 select builder 的排序结果。
 * 优先使用外部显式排序，其次回退到调用方提供的默认排序，最后才使用全局 id desc 回退。
 * 返回结果保持扁平对象，避免 helper 本身再引入 getter 和缓存状态。
 */
export function buildDrizzleOrderBy<TTable extends AnyPgTable = AnyPgTable>(
  inputOrderBy?: unknown,
  options: DrizzleOrderByOptions<TTable> = {},
) {
  const validColumns = options.table
    ? (getColumns(options.table) as Record<string, unknown>)
    : undefined

  let orderByRecords = normalizeOrderByRecords(
    inputOrderBy ?? options.fallbackOrderBy,
    validColumns,
  )

  if (!orderByRecords && validColumns?.id) {
    orderByRecords = [{ id: 'desc' }]
  }

  orderByRecords = appendStableIdOrderBy(orderByRecords, validColumns)
  const orderBy = buildRelationOrderBy(orderByRecords)

  return {
    orderBy,
    orderBySql: buildOrderBySql(orderBy, validColumns),
  }
}
