import type { AppDateRange } from '@libs/platform/utils'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type {
  AllowlistedOrderByOptions,
  DrizzleOrderByInput,
  DrizzleOrderByOptions,
} from './order-by'
import type {
  DrizzlePageQueryInput,
  DrizzlePageQueryOptions,
} from './page-query'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { buildAllowlistedOrderBy, buildDrizzleOrderBy } from './order-by'
import { buildDrizzlePageQuery } from './page-query'

export interface DrizzlePageParamsInput extends DrizzlePageQueryInput {
  orderBy?: DrizzleOrderByInput
  startDate?: string
  endDate?: string
}

export interface DrizzlePageParamsOptions<
  TTable extends AnyPgTable = AnyPgTable,
>
  extends
    DrizzlePageQueryOptions,
    Pick<DrizzleOrderByOptions<TTable>, 'table' | 'fallbackOrderBy'> {
  allowlistedOrderBy?: AllowlistedOrderByOptions
}

export type DrizzlePageParamsOrder = ReturnType<typeof buildDrizzleOrderBy> &
  Partial<Pick<ReturnType<typeof buildAllowlistedOrderBy>, 'orderByClause'>>

export interface DrizzlePageParamsResult {
  page: ReturnType<typeof buildDrizzlePageQuery>
  order: DrizzlePageParamsOrder
  dateRange?: AppDateRange
}

/**
 * 统一归一化 PageDto 的分页、排序和日期范围参数。
 * 不接收业务列，也不生成 where 条件，日期字段映射必须留在 owner service。
 */
export function buildDrizzlePageParams<TTable extends AnyPgTable = AnyPgTable>(
  input: DrizzlePageParamsInput = {},
  options: DrizzlePageParamsOptions<TTable>,
): DrizzlePageParamsResult {
  const page = buildDrizzlePageQuery(input, options)
  const order = options.allowlistedOrderBy
    ? buildAllowlistedOrderBy(input.orderBy, {
        ...options.allowlistedOrderBy,
        fallbackOrderBy:
          options.allowlistedOrderBy.fallbackOrderBy ?? options.fallbackOrderBy,
      })
    : buildDrizzleOrderBy(input.orderBy, {
        table: options.table,
        fallbackOrderBy: options.fallbackOrderBy,
      })
  const dateRange = buildDateOnlyRangeInAppTimeZone(
    input.startDate,
    input.endDate,
  )

  return {
    page,
    order,
    dateRange,
  }
}
