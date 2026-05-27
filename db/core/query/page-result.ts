export interface PageResult<T> {
  list: T[]
  total: number
  pageIndex: number
  pageSize: number
}

interface PageResultInput {
  pageIndex: number
  pageSize: number
}

/**
 * 仅组装分页返回形状，查询、排序、计数和字段投影都留在业务 owner 中显式表达。
 */
export function toPageResult<T>(
  list: T[],
  total: number,
  page: PageResultInput,
): PageResult<T> {
  return {
    list,
    total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}
