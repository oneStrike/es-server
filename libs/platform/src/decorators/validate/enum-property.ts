import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { EnumPropertyOptions } from './types'
import { getNumberEnumValues, isDevelopment, isNumberEnum } from '@libs/platform/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsOptional } from 'class-validator'

/**
 * 枚举属性装饰器
 *
 * @description 用于定义枚举类型的字段，支持字符串和数字枚举
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * enum UserStatus {
 *   ACTIVE = 'active',
 *   INACTIVE = 'inactive',
 *   PENDING = 'pending'
 * }
 *
 * enum Priority {
 *   LOW = 1,
 *   MEDIUM = 2,
 *   HIGH = 3
 * }
 *
 * class CreateTaskDto {
 *   @EnumProperty({
 *     description: '任务状态',
 *     example: UserStatus.ACTIVE,
 *     enum: UserStatus,
 *     required: true
 *   })
 *   status: UserStatus
 *
 *   @EnumProperty({
 *     description: '任务优先级',
 *     example: Priority.MEDIUM,
 *     enum: Priority,
 *     default: Priority.LOW,
 *     required: false
 *   })
 *   priority?: Priority
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function EnumProperty(options: EnumPropertyOptions) {
  const validation = options.validation ?? true
  const isNumEnum = isNumberEnum(options.enum)

  const decorators: any[] = []

  if (validation) {
    // 对于数字枚举，使用 IsIn 替代 IsEnum，避免双向映射问题
    // TypeScript 数字枚举会生成反向映射（如 1 -> 'CREATE_TOPIC'），
    // IsEnum 会把反向映射的字符串也当作有效值，这是我们不想要的
    if (isNumEnum) {
      const validValues = getNumberEnumValues(options.enum)
      decorators.push(
        IsIn(validValues, {
          message: `必须是有效的枚举值: ${validValues.join(', ')}`,
        }),
      )
    } else {
      decorators.push(
        IsEnum(options.enum, {
          message: `必须是有效的枚举值: ${Object.values(options.enum).join(', ')}`,
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

        if (value === undefined || value === null) {
          return value
        }

        if (isNumEnum && typeof value === 'string') {
          const trimmedValue = value.trim()
          if (trimmedValue === '') {
            return undefined
          }
          const numValue = Number(trimmedValue)
          const validValues = getNumberEnumValues(options.enum)
          if (!Number.isNaN(numValue) && validValues.includes(numValue)) {
            return numValue
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
      enum: options.enum,
    }
    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
