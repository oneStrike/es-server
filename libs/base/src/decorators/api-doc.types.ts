import type { Type } from '@nestjs/common'

/**
 * API 文档装饰器配置
 * 用于统一 Swagger 元数据
 */
export interface ApiDocOptions<TModel> {
  /** 接口摘要 */
  summary: string
  /** 返回模型 */
  model?: Type<TModel> | Record<string, any>
  /** 是否返回数组 */
  isArray?: boolean
}
