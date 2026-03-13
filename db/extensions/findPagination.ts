import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { Db } from '../drizzle.provider'
import { DbConfig } from '@libs/platform/config'
import { jsonParse } from '@libs/platform/utils'
import { and, asc, desc, gte, lt, sql } from 'drizzle-orm'

/** 排序方向值类型 */
type OrderByValue = 'asc' | 'desc' | 'ASC' | 'DESC' | string
/** 排序记录类型：字段名到排序方向的映射 */
type OrderByRecord = Record<string, OrderByValue>
/** 排序输入类型：支持多种格式 */
type OrderByInput = OrderByRecord | OrderByRecord[] | string | null | undefined

/** 分页查询选项接口 */
interface FindPaginationOptions {
  /** 查询条件 */
  where?: SQL
  /** 页码（从1开始） */
  pageIndex?: number | string
  /** 每页数量 */
  pageSize?: number | string
  /** 开始日期（用于日期范围筛选） */
  startDate?: string | Date
  /** 结束日期（用于日期范围筛选） */
  endDate?: string | Date
  /** 排序规则 */
  orderBy?: OrderByInput
  /** 日期字段名，默认为 'createdAt' */
  dateColumn?: string
}

/**
 * 标准化排序方向值
 * 将输入值转换为标准的 'asc' 或 'desc'，无效值返回 null
 * @param value - 输入的排序方向值
 * @returns 标准化的排序方向或 null
 */
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

/**
 * 标准化排序输入
 * 将多种格式的排序输入转换为 Drizzle ORM 的排序 SQL 数组
 * @param table - 目标表
 * @param orderByInput - 排序输入（支持对象、数组或 JSON 字符串）
 * @returns 排序 SQL 数组或 undefined
 */
function normalizeOrderBy(
  table: PgTable<TableConfig>,
  orderByInput: OrderByInput,
): SQL[] | undefined {
  const tableAsAny = table as any
  // 如果是字符串，尝试解析为 JSON
  const parsed =
    typeof orderByInput === 'string'
      ? (jsonParse(orderByInput) as OrderByInput)
      : orderByInput

  const records: OrderByRecord[] = []

  // 统一转换为数组格式处理
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

  // 构建排序 SQL 数组
  const orderBy: SQL[] = []
  for (const record of records) {
    for (const [field, direction] of Object.entries(record)) {
      const column = tableAsAny[field]
      if (!column) {
        continue // 跳过不存在的字段
      }
      const normalized = normalizeDirection(direction)
      if (!normalized) {
        continue // 跳过无效的排序方向
      }
      orderBy.push(normalized === 'asc' ? asc(column) : desc(column))
    }
  }

  return orderBy.length > 0 ? orderBy : undefined
}

/**
 * 将输入值转换为 Date 对象
 * 支持字符串和 Date 对象输入，无效值返回 null
 * @param value - 日期字符串或 Date 对象
 * @returns Date 对象或 null
 */
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

/**
 * 分页查询
 * 提供通用的分页查询功能，支持排序、日期范围筛选等
 * @param db - 数据库连接实例
 * @param table - 目标表
 * @param options - 分页查询选项
 * @returns 分页结果，包含列表数据、总数、页码和每页数量
 */
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

  // 标准化页码：确保页码为有效整数，小于1时处理为0或1
  const rawPageIndex = Number.isFinite(Number(pageIndex))
    ? Math.floor(Number(pageIndex))
    : DbConfig.query.pageIndex
  const normalizedPageIndex =
    rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)

  // 标准化每页数量：限制在有效范围内
  const normalizedPageSizeBase = Number.isFinite(Number(pageSize))
    ? Math.floor(Number(pageSize))
    : DbConfig.query.pageSize
  const normalizedPageSize = Math.min(
    Math.max(1, normalizedPageSizeBase),
    DbConfig.query.maxListItemLimit,
  )

  // 计算偏移量：页码从1开始时需要减1
  const offset =
    normalizedPageIndex >= 1
      ? (normalizedPageIndex - 1) * normalizedPageSize
      : normalizedPageIndex * normalizedPageSize

  // 获取日期字段引用，用于日期范围筛选
  const tableAsRecord = table as unknown as Record<string, SQLWrapper>
  const dateColumnRef = tableAsRecord[dateColumn]

  // 构建日期范围条件
  let dateCondition: SQL | undefined
  const start = toDate(startDate)
  const end = toDate(endDate)
  if (dateColumnRef && (start || end)) {
    const conditions: SQL[] = []
    if (start) {
      conditions.push(gte(dateColumnRef, start))
    }
    if (end) {
      // 结束日期需要包含当天，所以加1天后用小于比较
      const endDateValue = new Date(end)
      endDateValue.setDate(endDateValue.getDate() + 1)
      conditions.push(lt(dateColumnRef, endDateValue))
    }
    if (conditions.length > 0) {
      dateCondition =
        conditions.length === 1 ? conditions[0] : and(...conditions)
    }
  }

  // 合并基础条件和日期条件
  const finalWhere =
    where && dateCondition
      ? and(where, dateCondition)
      : (where ?? dateCondition)

  // 解析排序规则，优先使用传入的排序，否则使用默认配置
  const resolvedOrderBy =
    normalizeOrderBy(table, orderBy) ||
    normalizeOrderBy(table, DbConfig.query.orderBy)

  // 并行执行查询和计数，提高性能
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
