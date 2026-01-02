import { DbConfig } from '../../config'
import { jsonParse } from '../../utils'
import { Prisma } from '../prisma-client/client'

/**
 * 分页查询扩展
 */
export async function findPagination<T, A>(
  this: T,
  options: Prisma.Args<T, 'findMany'>,
): Promise<{
  list: Prisma.Result<T, A, 'findMany'>
  total: number
  pageIndex: number
  pageSize: number
}> {
  const context = Prisma.getExtensionContext(this) as any
  // 读取 where，但不要突变原对象
  const rawWhere = (options as any)?.where ?? {}
  let { pageIndex, pageSize, startDate, endDate, orderBy, ...otherWhere } =
    rawWhere

  // 规范化分页参数，并智能识别 0 基/1 基传参：
  // - 若传入 pageIndex=0，则按 0 基；若传入 >=1，则按 1 基
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

  // 日期区间过滤：仅在可解析时生效
  const hasStart = !!startDate
  const hasEnd = !!endDate
  if (hasStart || hasEnd) {
    const dateCond: Record<string, Date> = {}
    if (hasStart) {
      const start = new Date(startDate)
      if (!Number.isNaN(start.getTime())) {
        dateCond.gte = start
      }
    }
    if (hasEnd) {
      const end = new Date(endDate)
      if (!Number.isNaN(end.getTime())) {
        // 使 endDate 为闭区间：第二天的 00:00 作为上界（不含）
        end.setDate(end.getDate() + 1)
        dateCond.lt = end
      }
    }
    if (Object.keys(dateCond).length > 0) {
      otherWhere = { ...otherWhere, createdAt: dateCond }
    }
  }

  // 计算跳过数量：根据上面规范化后的 0/1 基兼容值
  const skip = Math.max(
    0,
    normalizedPageIndex >= 1
      ? (normalizedPageIndex - 1) * normalizedPageSize
      : normalizedPageIndex * normalizedPageSize,
  )
  const take = normalizedPageSize
  orderBy = orderBy
    ? jsonParse(orderBy)
    : options.orderBy || DbConfig?.query.orderBy
  // 并行查询列表与总数
  const [list, total] = await Promise.all<
    [Prisma.Result<T, A, 'findMany'>, number]
  >([
    context.findMany({
      ...(options || {}),
      where: otherWhere,
      take,

      skip,
      orderBy,
    }),
    context.count({ where: otherWhere }),
  ])

  return {
    list,
    total,
    pageIndex: normalizedPageIndex,
    pageSize: normalizedPageSize,
  }
}
