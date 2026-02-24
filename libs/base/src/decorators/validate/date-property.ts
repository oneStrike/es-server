import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { DatePropertyOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsDate, IsOptional } from 'class-validator'

/**
 * 日期属性装饰器
 *
 * @description 用于定义日期类型的字段，支持字符串和数字到Date对象的智能转换
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateEventDto {
 *   @DateProperty({
 *     description: '事件开始时间',
 *     example: '2024-01-01T00:00:00.000Z',
 *     required: true
 *   })
 *   startTime: Date
 *
 *   @DateProperty({
 *     description: '事件结束时间',
 *     example: null,
 *     default: null,
 *     required: false
 *   })
 *   endTime?: Date
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function DateProperty(options: DatePropertyOptions) {
  const validation = options.validation ?? true

  const decorators: any[] = []

  if (validation) {
    decorators.push(IsDate({ message: '必须是有效的日期格式' }))

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
          const dateValue = new Date(trimmedValue)
          return Number.isNaN(dateValue.getTime()) ? value : dateValue
        }

        if (typeof value === 'number') {
          const dateValue = new Date(value)
          return Number.isNaN(dateValue.getTime()) ? value : dateValue
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
      type: Date,
      format: 'date-time',
    }
    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
