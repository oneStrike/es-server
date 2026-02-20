/**
 * 响应 DTO 元数据常量与类型
 * 用于装饰器写入并读取响应模型信息
 */
import type { Type } from '@nestjs/common'
import { SetMetadata } from '@nestjs/common'

export const RESPONSE_DTO_METADATA_KEY = 'responseDtoMetadata'

/**
 * 响应 DTO 元数据结构
 */
export interface ResponseDtoMetadata<TModel = any> {
  /** 响应模型类型或结构描述 */
  model?: Type<TModel> | Record<string, any>
  /** 是否数组响应 */
  isArray?: boolean
  /** 是否分页响应 */
  isPage?: boolean
}

/**
 * 写入响应 DTO 元数据
 */
export function SetResponseDtoMetadata(metadata: ResponseDtoMetadata) {
  return SetMetadata(RESPONSE_DTO_METADATA_KEY, metadata)
}
