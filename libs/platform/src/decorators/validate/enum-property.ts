import type { EnumPropertyOptions } from './types'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsOptional } from 'class-validator'
import { buildContractPropertyDecorators } from './contract'
import {
  createEnumValueValidator,
  normalizeEnumPropertyValue,
  resolveEnumValidationArtifacts,
} from './enum-shared'

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
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)
  const required = options.required ?? true
  const enumArtifacts = resolveEnumValidationArtifacts(options.enum)

  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(createEnumValueValidator(options.enum, enumArtifacts, {
      message: `必须是有效的枚举值: ${enumArtifacts.validValues.join(', ')}`,
    }))

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

        if (value === undefined || value === null) {
          return value
        }

        return normalizeEnumPropertyValue(value, enumArtifacts)
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
      enum: options.enum,
    })),
  )

  return applyDecorators(...decorators)
}
