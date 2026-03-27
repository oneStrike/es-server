export interface DrizzlePageQueryInput {
  pageIndex?: number | string
  pageSize?: number | string
}

export interface DrizzlePageQueryOptions {
  defaultPageIndex: number
  defaultPageSize: number
  maxPageSize: number
}

/**
 * 统一将外部页码收敛为 1-based，避免业务层再重复处理非法值和 0 页输入。
 */
function normalizePageIndex(
  value: DrizzlePageQueryInput['pageIndex'],
  fallback: number,
): number {
  const rawPageIndex = Number.isFinite(Number(value))
    ? Math.floor(Number(value))
    : fallback
  return Math.max(1, rawPageIndex)
}

/**
 * 仅负责分页参数的归一化和 limit/offset 计算，不再承担任何排序语义。
 */
export function buildDrizzlePageQuery(
  input: DrizzlePageQueryInput = {},
  options: DrizzlePageQueryOptions,
) {
  const pageIndex = normalizePageIndex(
    input.pageIndex,
    options.defaultPageIndex,
  )
  const rawPageSize = Number.isFinite(Number(input.pageSize))
    ? Math.floor(Number(input.pageSize))
    : options.defaultPageSize
  const resolvedMaxPageSize = Math.max(
    1,
    Math.floor(Number(options.maxPageSize)),
  )
  const pageSize = Math.min(Math.max(1, rawPageSize), resolvedMaxPageSize)
  // 对外分页契约统一使用 1-based 页码，数据库 offset 仍然从 0 开始。
  const offset = (pageIndex - 1) * pageSize

  return {
    pageIndex,
    pageSize,
    limit: pageSize,
    offset,
  }
}
