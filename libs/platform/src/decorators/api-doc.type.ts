import type { Type } from '@nestjs/common'

/** API 文档响应模型构造器。 */
export type ApiDocConstructorModel<TModel extends object = object> =
  Type<TModel> | StringConstructor | NumberConstructor | BooleanConstructor

/** API JSON 响应文档装饰器配置，用于统一 Swagger 成功响应 envelope。 */
export interface ApiDocOptions<TModel extends object = object> {
  /** 接口摘要。 */
  summary: string
  /** 返回模型或原始 OpenAPI schema。 */
  model?: ApiDocConstructorModel<TModel> | Record<string, unknown>
  /** data 是否为数组。 */
  isArray?: boolean
  /** data 是否允许为 null；用于真实返回整个 data=null 的接口。 */
  nullable?: boolean
}

/** HTML 响应文档配置，用于 text/html 成功响应的受控例外。 */
export interface ApiHtmlDocOptions {
  /** 接口摘要。 */
  summary: string
  /** 响应描述。 */
  description?: string
  /** HTML 示例。 */
  example?: string
}
