/**
 * 请求日志类型与查询条件定义
 */

export type LogOutcomeType = 'SUCCESS' | 'FAILURE'

/**
 * 请求上下文在 AsyncLocalStorage 中存储的数据
 */
export interface RequestContextData {
  traceId: string
  startAt: number // performance.now() or Date.now()
  method: string
  path: string
  ip?: string
  userAgent?: string
  device?: Record<string, any> | null
  params?: Record<string, any> | null
  userId?: number | null
  userType?: string | null
  statusCode?: number | null
  responseTimeMs?: number | null
}

/**
 * 额外日志参数（与上下文合并）
 */
export interface LogExtras {
  actionType?: string
  statusCode?: number
  actionResult?: LogOutcomeType | boolean
  errorMessage?: string | null
  userId?: number | null
  userType?: string | null
  params?: Record<string, any> | null
  device?: Record<string, any> | null
  traceId?: string | null
  responseTimeMs?: number | null
  extras?: Record<string, any> | null
  method?: string
  path?: string
  ip?: string
  userAgent?: string
}

/**
 * 查询过滤条件
 */
export interface LogQueryFilters {
  startAt?: Date
  endAt?: Date
  userId?: number
  actionType?: string
  page?: number
  pageSize?: number
}
