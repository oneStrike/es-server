import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ValidateNestedOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ValidateNested as CVValidateNested,
  IsObject,
  IsOptional,
} from 'class-validator'

/**
 * 嵌套对象验证装饰器
 *
 * @description 用于验证嵌套的对象字段
 *
 * @example
 * ```typescript
 * class UserProfileDto {
 *   @ValidateString({ description: '姓名' })
 *   name: string
 * }
 *
 * class CreateUserDto {
 *   @ValidateNested({
 *     description: '用户资料',
 *     type: UserProfileDto,
 *     required: true
 *   })
 *   profile: UserProfileDto
 * }
 * ```
 *
 * @param options 验证选项配置
 * @returns 装饰器函数
 */
export function ValidateNested(options: ValidateNestedOptions) {
  // 基础装饰器
  const decorators = [
    IsObject({ message: '必须是对象类型' }),
    CVValidateNested({ message: '嵌套对象验证失败' }),
    Type(() => options.type),
  ]

  // 可选字段处理
  if (!(options.required ?? true)) {
    decorators.push(IsOptional())
  }

  if (isDevelopment()) {
    // 构建API属性配置
    const apiPropertyOptions: ApiPropertyOptions = {
      description: options.description,
      required: options.required ?? true,
      type: options.type,
    }

    if (options.example) {
      apiPropertyOptions.example = options.example
    }

    if (options.default !== undefined) {
      apiPropertyOptions.default = options.default
    }

    if (!(options.required ?? true)) {
      apiPropertyOptions.nullable = true
    }

    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
