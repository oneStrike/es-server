import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ValidateEnumOptions } from './types'
import { isDevelopment, isNumberEnum } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsOptional } from 'class-validator'

/**
 * 枚举验证装饰器
 *
 * @description 用于验证枚举类型的字段，支持字符串和数字枚举
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
 *   @ValidateEnum({
 *     description: '任务状态',
 *     example: UserStatus.ACTIVE,
 *     enum: UserStatus,
 *     required: true
 *   })
 *   status: UserStatus
 *
 *   @ValidateEnum({
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
 * @param options 验证选项配置
 * @returns 装饰器函数
 */
export function ValidateEnum(options: ValidateEnumOptions) {
  // 基础装饰器
  const decorators = [
    IsEnum(options.enum, {
      message: `必须是有效的枚举值: ${Object.values(options.enum).join(', ')}`,
    }),
  ]

  // 可选字段处理
  if (!(options.required ?? true)) {
    decorators.push(IsOptional())
  }

  // 转换逻辑
  decorators.push(
    Transform(({ value }) => {
      // 处理默认值
      if (
        (value === undefined || value === null) &&
        options.default !== undefined
      ) {
        return options.default
      }

      // 处理空值和可选字段
      if (value === undefined || value === null) {
        return value
      }

      // 对于数字枚举，尝试字符串转数字
      if (isNumberEnum(options.enum) && typeof value === 'string') {
        const trimmedValue = value.trim()
        if (trimmedValue === '') {
          return undefined
        }
        const numValue = Number(trimmedValue)
        if (
          !Number.isNaN(numValue) &&
          Object.values(options.enum).includes(numValue)
        ) {
          return numValue
        }
      }

      // 字符串trim处理
      if (typeof value === 'string') {
        return value.trim()
      }

      return value
    }),
  )

  // 自定义转换函数
  if (options.transform) {
    decorators.push(Transform(options.transform))
  }

  if (isDevelopment()) {
    // 构建API属性配置
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
