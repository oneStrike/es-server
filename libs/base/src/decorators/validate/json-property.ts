import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { JsonPropertyOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsJSON, IsOptional } from 'class-validator'

/**
 * JSON属性装饰器
 *
 * @description 用于定义JSON字符串格式的字段，支持对象到JSON字符串的自动转换
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateConfigDto {
 *   @JsonProperty({
 *     description: '配置数据',
 *     example: '{"theme": "dark", "language": "zh-CN"}',
 *     required: true
 *   })
 *   configData: string
 *
 *   @JsonProperty({
 *     description: '元数据',
 *     example: null,
 *     default: '{}',
 *     required: false
 *   })
 *   metadata?: string
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function JsonProperty(options: JsonPropertyOptions) {
  const validation = options.validation ?? true

  const decorators: any[] = []

  if (validation) {
    decorators.push(IsJSON({ message: '必须是有效的JSON字符串格式' }))

    if (!(options.required ?? true)) {
      decorators.push(IsOptional())
    }

    decorators.push(
      Transform(({ value }) => {
        if (
          (value === undefined || value === null) &&
          options.default !== undefined
        ) {
          return options.default
        }

        if (typeof value === 'object' && value !== null) {
          try {
            return JSON.stringify(value)
          } catch {
            return value
          }
        }

        if (typeof value === 'string') {
          return value.trim()
        }

        return value
      }),
    )

    if (options.transform) {
      decorators.push(Transform(options.transform))
    }
  }

  if (isDevelopment()) {
    const apiPropertyOptions: ApiPropertyOptions = {
      description: options.description,
      example: options.example,
      required: options.required ?? true,
      default: options.default,
      nullable: !(options.required ?? true),
      type: String,
      format: 'json',
    }
    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
