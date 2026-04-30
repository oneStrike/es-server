import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { StringPropertyOptions } from './validate.type'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'
import { buildContractPropertyDecorators } from './contract'

/**
 * 字符串属性装饰器
 *
 * @description 用于定义字符串类型的字段，支持长度限制、密码强度验证、ISO8601日期格式等
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateUserDto {
 *   @StringProperty({
 *     description: '用户名',
 *     example: 'john_doe',
 *     minLength: 3,
 *     maxLength: 20,
 *     required: true
 *   })
 *   username: string
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function StringProperty(options: StringPropertyOptions) {
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)

  if (
    options.minLength &&
    options.maxLength &&
    options.minLength > options.maxLength
  ) {
    throw new Error('StringProperty: minLength 不能大于 maxLength')
  }

  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(IsString({ message: '必须是字符串类型' }))

    if (options.password) {
      decorators.push(
        IsStrongPassword(
          {
            minLength: 8,
            minUppercase: 1,
            minLowercase: 1,
            minSymbols: 1,
          },
          {
            message:
              '密码必须包含至少8个字符，包括大写字母、小写字母和特殊符号',
          },
        ),
      )
    }

    if (options.maxLength !== undefined) {
      decorators.push(
        MaxLength(options.maxLength, {
          message: `字符串长度不能超过${options.maxLength}个字符`,
        }),
      )
    }

    if (options.minLength !== undefined) {
      decorators.push(
        MinLength(options.minLength, {
          message: `字符串长度不能少于${options.minLength}个字符`,
        }),
      )
    }

    if (options.type === 'ISO8601') {
      decorators.push(IsISO8601({}, { message: '必须是有效的ISO8601日期格式' }))
    }

    if (options.type === 'url') {
      decorators.push(IsUrl({}, { message: '必须是有效的URL地址' }))
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
    ...buildContractPropertyDecorators(options, () => {
      const apiPropertyOptions: ApiPropertyOptions = {
        description: options.description,
        example: options.example,
        required: options.required ?? true,
        default: options.default,
        nullable: options.nullable ?? !(options.required ?? true),
        type: String,
      }

      if (options.minLength !== undefined || options.maxLength !== undefined) {
        apiPropertyOptions.minLength = options.minLength
        apiPropertyOptions.maxLength = options.maxLength
      }

      return apiPropertyOptions
    }),
  )

  return applyDecorators(...decorators)
}
