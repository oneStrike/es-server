import { HttpStatus } from '@nestjs/common'

/**
 * 成功响应码
 */
export const ApiSuccessCode = 'SUCCESS'

/**
 * 平台错误码
 */
export const PlatformErrorCode = {
  /**
   * 请求参数错误
   */
  BAD_REQUEST: 'BAD_REQUEST',
  /**
   * 请求语义校验失败
   */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /**
   * 未授权
   */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /**
   * 禁止访问
   */
  FORBIDDEN: 'FORBIDDEN',
  /**
   * 路由不存在
   */
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  /**
   * 请求体过大
   */
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  /**
   * 请求频率限制
   */
  RATE_LIMITED: 'RATE_LIMITED',
  /**
   * 服务暂不可用
   */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /**
   * 未单独分类的 HTTP 错误
   */
  HTTP_ERROR: 'HTTP_ERROR',
  /**
   * 内部服务器错误
   */
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const

/**
 * 业务错误码
 */
export const BusinessErrorCode = {
  /**
   * 资源不存在
   */
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  /**
   * 资源已存在
   */
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  /**
   * 状态冲突
   */
  STATE_CONFLICT: 'STATE_CONFLICT',
  /**
   * 当前操作不允许
   */
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  /**
   * 额度不足
   */
  QUOTA_NOT_ENOUGH: 'QUOTA_NOT_ENOUGH',
  /**
   * 操作目标类型不支持
   */
  INVALID_OPERATION_TARGET: 'INVALID_OPERATION_TARGET',
} as const

export type ApiSuccessCodeValue = typeof ApiSuccessCode
export type PlatformErrorCodeValue =
  (typeof PlatformErrorCode)[keyof typeof PlatformErrorCode]
export type BusinessErrorCodeValue =
  (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode]
export type ApiErrorCode = PlatformErrorCodeValue | BusinessErrorCodeValue
export type ApiResponseCode = ApiSuccessCodeValue | ApiErrorCode

export function isBusinessErrorCode(
  code: unknown,
): code is BusinessErrorCodeValue {
  return Object.values(BusinessErrorCode).includes(
    code as BusinessErrorCodeValue,
  )
}

export function getBusinessErrorHttpStatus(
  code: BusinessErrorCodeValue,
): number {
  switch (code) {
    case BusinessErrorCode.RESOURCE_NOT_FOUND:
      return HttpStatus.NOT_FOUND
    case BusinessErrorCode.RESOURCE_ALREADY_EXISTS:
    case BusinessErrorCode.STATE_CONFLICT:
      return HttpStatus.CONFLICT
    case BusinessErrorCode.OPERATION_NOT_ALLOWED:
    case BusinessErrorCode.QUOTA_NOT_ENOUGH:
    case BusinessErrorCode.INVALID_OPERATION_TARGET:
      return HttpStatus.UNPROCESSABLE_ENTITY
  }
}

export function getPlatformErrorCode(status: number): PlatformErrorCodeValue {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return PlatformErrorCode.BAD_REQUEST
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return PlatformErrorCode.VALIDATION_FAILED
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
    case HttpStatus.SERVICE_UNAVAILABLE:
      return PlatformErrorCode.SERVICE_UNAVAILABLE
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? PlatformErrorCode.INTERNAL_SERVER_ERROR
        : PlatformErrorCode.HTTP_ERROR
  }
}
