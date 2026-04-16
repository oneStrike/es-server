/**
 * 标准响应结构
 *
 * @template T 响应数据类型
 */
/** 稳定领域类型 `Response`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface Response<T> {
  /** 业务码 */
  code: number
  /** 响应数据 */
  data: T
  /** 提示信息 */
  message: string
}
