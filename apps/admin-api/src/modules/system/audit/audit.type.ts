import type { ApiTypeEnum, HttpMethodEnum } from '@libs/platform/constant'
import type { AuditActionTypeEnum } from './audit.constant'

/**
 * 审计日志创建入参。
 * 用于记录后台操作日志的核心业务字段。
 */
export interface CreateRequestLogInput {
  userId?: number
  username?: string
  actionType?: AuditActionTypeEnum
  isSuccess: boolean
  content: string
}

/**
 * 审计成功日志快速创建入参。
 * 用于只关心基础内容、用户名与用户 id 的简化场景。
 */
export interface CreateRequestLogSimpleInput {
  userId?: number
  username?: string
  content: string
}

/**
 * 审计日志分页查询入参。
 * 用于后台操作日志的分页与多字段筛选。
 */
export interface AuditPageQueryInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  userId?: number
  username?: string
  ip?: string
  method?: HttpMethodEnum
  path?: string
  apiType?: ApiTypeEnum
  actionType?: AuditActionTypeEnum
  isSuccess?: boolean
}
