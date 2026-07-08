import type {
  ApiErrorCode,
  BusinessErrorCodeValue,
} from '@libs/platform/constant'
import type { HttpStatus } from '@nestjs/common'

/** 全局 HTTP 异常过滤器使用的响应描述器，统一状态码、业务码与提示语。 */
export interface ErrorDescriptor {
  status: HttpStatus
  responseCode: ApiErrorCode
  message: string
  businessCode?: BusinessErrorCodeValue
}
