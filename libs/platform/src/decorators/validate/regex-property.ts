import type { RegexPropertyOptions } from './validate.type'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, Matches } from 'class-validator'
import { buildContractPropertyDecorators } from './contract'

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
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)

  const decorators: PropertyDecorator[] = []

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

  decorators.push(
    ...buildContractPropertyDecorators(options, () => ({
      description: options.description,
      example: options.example,
      required: options.required ?? true,
      default: options.default,
      nullable: !(options.required ?? true),
      type: String,
      pattern: options.regex.source,
    })),
  )

  return applyDecorators(...decorators)
}
