import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { NumberPropertyOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNumber, IsOptional, Max, Min } from 'class-validator'

/**
 * 数字属性装饰器
 *
 * @description 用于定义数字类型的字段，支持范围限制、默认值等
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateProductDto {
 *   @NumberProperty({
 *     description: '商品价格',
 *     example: 99.99,
 *     min: 0,
 *     max: 10000,
 *     required: true
 *   })
 *   price: number
 *
 *   @NumberProperty({
 *     description: '商品数量',
 *     example: 10,
 *     min: 1,
 *     default: 1,
 *     required: false
 *   })
 *   quantity?: number
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function NumberProperty(options: NumberPropertyOptions) {
  const validation = options.validation ?? true

  if (options.min !== undefined && options.max !== undefined && options.min > options.max) {
    throw new Error('NumberProperty: min 不能大于 max')
  }

  const decorators: any[] = []

  if (validation) {
    decorators.push(IsNumber({}, { message: '必须是数字类型' }))

    if (options.max !== undefined) {
      decorators.push(
        Max(options.max, {
          message: `数值不能大于${options.max}`,
        }),
      )
    }

    if (options.min !== undefined) {
      decorators.push(
        Min(options.min, {
          message: `数值不能小于${options.min}`,
        }),
      )
    }

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

        if (typeof value === 'string') {
          const trimmedValue = value.trim()
          if (trimmedValue === '') {
            return undefined
          }
          const numValue = Number(trimmedValue)
          return Number.isNaN(numValue) ? value : numValue
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
      type: Number,
    }

    if (options.min !== undefined) {
      apiPropertyOptions.minimum = options.min
    }
    if (options.max !== undefined) {
      apiPropertyOptions.maximum = options.max
    }
    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
