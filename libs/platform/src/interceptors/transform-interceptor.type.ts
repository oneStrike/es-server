import type { ApiSuccessCodeValue } from '@libs/platform/constant'

/**
 * HTTP 成功响应统一包装结构。
 */
export interface TransformResponse<T> {
  code: ApiSuccessCodeValue
  data: T
  message: string
}
