import { HttpStatus } from '@nestjs/common'

export const ApiSuccessCode = 0

export const PlatformErrorCode = {
  BAD_REQUEST: 10001,
  UNAUTHORIZED: 10002,
  FORBIDDEN: 10003,
  ROUTE_NOT_FOUND: 10004,
  PAYLOAD_TOO_LARGE: 10005,
  RATE_LIMITED: 10006,
  INTERNAL_SERVER_ERROR: 50001,
} as const

export const BusinessErrorCode = {
  RESOURCE_NOT_FOUND: 20001,
  RESOURCE_ALREADY_EXISTS: 20002,
  STATE_CONFLICT: 20003,
  OPERATION_NOT_ALLOWED: 20004,
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
