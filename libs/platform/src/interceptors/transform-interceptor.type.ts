/**
 * HTTP 成功响应统一包装结构。
 */
export interface TransformResponse<T> {
  code: number
  data: T
  message: string
}
