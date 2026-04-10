import type { BooleanPropertyOptions } from './types'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'
import { buildContractPropertyDecorators } from './contract'

/**
 * 布尔属性装饰器
 *
 * @description 用于定义布尔类型的字段，支持字符串和数字到布尔值的智能转换
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class UpdateSettingsDto {
 *   @BooleanProperty({
 *     description: '是否启用通知',
 *     example: true,
 *     default: false,
 *     required: false
 *   })
 *   enableNotifications?: boolean
 *
 *   @BooleanProperty({
 *     description: '是否公开资料',
 *     example: false,
 *     required: true
 *   })
 *   isPublic: boolean
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function BooleanProperty(options: BooleanPropertyOptions) {
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)
  const required = options.required ?? true

  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(IsBoolean({ message: '必须是布尔类型' }))

    if (!required) {
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
          const trimmedValue = value.trim().toLowerCase()
          if (trimmedValue === 'true' || trimmedValue === '1') {
            return true
          }
          if (trimmedValue === 'false' || trimmedValue === '0') {
            return false
          }
          return value
        }

        if (typeof value === 'number') {
          if (value === 1) {
            return true
          }

          if (value === 0) {
            return false
          }

          return value
        }

        return value
      }),
    )

    if (options.transform) {
      decorators.push(Transform(options.transform))
    }
  }

  decorators.push(
    ...buildContractPropertyDecorators(options, () => ({
      description: options.description,
      example: options.example,
      required,
      default: options.default,
      nullable: !required,
      type: Boolean,
    })),
  )

  return applyDecorators(...decorators)
}
