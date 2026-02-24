import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { NestedPropertyOptions } from './types'
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
 * 嵌套对象属性装饰器
 *
 * @description 用于定义嵌套的对象字段
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class UserProfileDto {
 *   @StringProperty({ description: '姓名' })
 *   name: string
 * }
 *
 * class CreateUserDto {
 *   @NestedProperty({
 *     description: '用户资料',
 *     type: UserProfileDto,
 *     required: true
 *   })
 *   profile: UserProfileDto
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function NestedProperty(options: NestedPropertyOptions) {
  const validation = options.validation ?? true

  const decorators: any[] = []

  if (validation) {
    decorators.push(
      IsObject({ message: '必须是对象类型' }),
      CVValidateNested({ message: '嵌套对象验证失败' }),
      Type(() => options.type),
    )

    if (!(options.required ?? true)) {
      decorators.push(IsOptional())
    }
  }

  if (isDevelopment()) {
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
