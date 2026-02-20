/**
 * 标准响应结构
 *
 * @template T 响应数据类型
 */
export interface Response<T> {
  /** 业务码 */
  code: number
  /** 响应数据 */
  data: T
  /** 提示信息 */
  message: string
}
