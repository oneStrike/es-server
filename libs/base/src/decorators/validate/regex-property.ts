import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { RegexPropertyOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, Matches } from 'class-validator'

/**
 * 正则表达式属性装饰器
 *
 * @description 用于通过正则表达式定义字符串格式的字段
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateUserDto {
 *   @RegexProperty({
 *     description: '手机号码',
 *     example: '13800138000',
 *     regex: /^1[3-9]\d{9}$/,
 *     message: '请输入有效的手机号码',
 *     required: true
 *   })
 *   phone: string
 *
 *   @RegexProperty({
 *     description: '邮政编码',
 *     example: '100000',
 *     regex: /^\d{6}$/,
 *     message: '邮政编码必须是6位数字',
 *     required: false
 *   })
 *   zipCode?: string
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function RegexProperty(options: RegexPropertyOptions) {
  const validation = options.validation ?? true

  const decorators: any[] = []

  if (validation) {
    decorators.push(
      IsString({ message: '必须是字符串类型' }),
      Matches(options.regex, {
        message: options.message || '格式不正确',
      }),
    )

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
      pattern: options.regex.source,
    }
    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
