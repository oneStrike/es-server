import { HttpStatus } from '@nestjs/common'

/**
 * 成功响应码
 */
export const ApiSuccessCode = 0

/**
 * 平台错误码
 */
export const PlatformErrorCode = {
  /**
   * 请求参数错误
   */
  BAD_REQUEST: 10001,
  /**
   * 未授权
   */
  UNAUTHORIZED: 10002,
  /**
   * 禁止访问
   */
  FORBIDDEN: 10003,
  /**
   * 路由不存在
   */
  ROUTE_NOT_FOUND: 10004,
  /**
   * 请求体过大
   */
  PAYLOAD_TOO_LARGE: 10005,
  /**
   * 请求频率限制
   */
  RATE_LIMITED: 10006,
  /**
   * 内部服务器错误
   */
  INTERNAL_SERVER_ERROR: 50001,
} as const

/**
 * 业务错误码
 */
export const BusinessErrorCode = {
  /**
   * 资源不存在
   */
  RESOURCE_NOT_FOUND: 20001,
  /**
   * 资源已存在
   */
  RESOURCE_ALREADY_EXISTS: 20002,
  /**
   * 状态冲突
   */
  STATE_CONFLICT: 20003,
  /**
   * 当前操作不允许
   */
  OPERATION_NOT_ALLOWED: 20004,
  /**
   * 额度不足
   */
  QUOTA_NOT_ENOUGH: 20005,
} as const

export function getPlatformErrorCode(status: number): number {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return PlatformErrorCode.BAD_REQUEST
    case HttpStatus.UNAUTHORIZED:
      return PlatformErrorCode.UNAUTHORIZED
    case HttpStatus.FORBIDDEN:
      return PlatformErrorCode.FORBIDDEN
    case HttpStatus.NOT_FOUND:
      return PlatformErrorCode.ROUTE_NOT_FOUND
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return PlatformErrorCode.PAYLOAD_TOO_LARGE
    case HttpStatus.TOO_MANY_REQUESTS:
      return PlatformErrorCode.RATE_LIMITED
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? PlatformErrorCode.INTERNAL_SERVER_ERROR
        : status
  }
}
