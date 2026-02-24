import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ArrayPropertyOptions } from './types'
import { isDevelopment } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator'

/**
 * 数组属性装饰器
 *
 * @description 用于定义不同类型数组的字段，支持长度限制、类型转换和自定义验证
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * class CreateOrderDto {
 *   @ArrayProperty({
 *     description: '商品ID列表',
 *     itemType: 'number',
 *     example: [1, 2, 3],
 *     minLength: 1,
 *     maxLength: 10,
 *     required: true
 *   })
 *   productIds: number[]
 *
 *   @ArrayProperty({
 *     description: '标签名称列表',
 *     itemType: 'string',
 *     example: ['tag1', 'tag2'],
 *     default: [],
 *     required: false
 *   })
 *   tagNames?: string[]
 *
 *   @ArrayProperty({
 *     description: '配置对象列表',
 *     itemType: 'object',
 *     example: [{ key: 'value' }],
 *     itemValidator: (value) => typeof value === 'object' && value !== null,
 *     itemErrorMessage: '数组中的每个元素都必须是有效的对象',
 *     required: true
 *   })
 *   configs: object[]
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function ArrayProperty<T = any>(options: ArrayPropertyOptions<T>) {
  const validation = options.validation ?? true

  if (
    options.minLength !== undefined &&
    options.maxLength !== undefined &&
    options.minLength > options.maxLength
  ) {
    throw new Error('ArrayProperty: minLength 不能大于 maxLength')
  }

  const decorators: any[] = []

  if (validation) {
    const getItemValidator = () => {
      switch (options.itemType) {
        case 'string':
          return IsString({
            each: true,
            message:
              options.itemErrorMessage || '数组中的每个元素都必须是字符串类型',
          })
        case 'number':
          return IsNumber(
            {},
            {
              each: true,
              message:
                options.itemErrorMessage || '数组中的每个元素都必须是数字类型',
            },
          )
        case 'boolean':
          return IsBoolean({
            each: true,
            message:
              options.itemErrorMessage || '数组中的每个元素都必须是布尔类型',
          })
        case 'object':
          return IsObject({
            each: true,
            message:
              options.itemErrorMessage || '数组中的每个元素都必须是对象类型',
          })
        default:
          return IsString({
            each: true,
            message:
              options.itemErrorMessage || '数组中的每个元素都必须是字符串类型',
          })
      }
    }

    decorators.push(
      IsArray({ message: '必须是数组类型' }),
      getItemValidator(),
    )

    if (options.itemValidator) {
      decorators.push(
        ValidateBy({
          name: 'customItemValidator',
          validator: {
            validate: (value: any[]) => {
              if (!Array.isArray(value)) {
                return true
              }
              return value.every((item) => options.itemValidator!(item))
            },
            defaultMessage: () =>
              options.itemErrorMessage || '数组中的元素验证失败',
          },
        }),
      )
    }

    if (options.required ?? true) {
      decorators.push(IsNotEmpty({ message: '数组不能为空' }))
    }

    if (options.maxLength !== undefined) {
      decorators.push(
        MaxLength(options.maxLength, {
          message: `数组长度不能超过${options.maxLength}个元素`,
        }),
      )
    }

    if (options.minLength !== undefined) {
      decorators.push(
        MinLength(options.minLength, {
          message: `数组长度不能少于${options.minLength}个元素`,
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

        if (Array.isArray(value)) {
          return value.map((item) => {
            switch (options.itemType) {
              case 'number':
                if (typeof item === 'string') {
                  const trimmedItem = item.trim()
                  if (trimmedItem === '') {
                    return item
                  }
                  const numValue = Number(trimmedItem)
                  return Number.isNaN(numValue) ? item : numValue
                }
                return item
              case 'boolean':
                if (typeof item === 'string') {
                  const lowerItem = item.toLowerCase().trim()
                  if (lowerItem === 'true' || lowerItem === '1') {
                    return true
                  }
                  if (lowerItem === 'false' || lowerItem === '0') {
                    return false
                  }
                  return item
                }
                return item
              case 'string':
                return typeof item === 'string' ? item : String(item)
              case 'object':
                if (typeof item === 'string') {
                  try {
                    return JSON.parse(item)
                  } catch {
                    return item
                  }
                }
                return item
              default:
                return item
            }
          })
        }

        return value
      }),
    )

    if (options.transform) {
      decorators.push(Transform(options.transform))
    }
  }

  if (isDevelopment()) {
    const getApiType = () => {
      switch (options.itemType) {
        case 'string':
          return String
        case 'number':
          return Number
        case 'boolean':
          return Boolean
        case 'object':
          return Object
        default:
          return String
      }
    }

    const apiPropertyOptions: ApiPropertyOptions = {
      description: options.description,
      example: options.example,
      required: options.required ?? true,
      default: options.default,
      nullable: !(options.required ?? true),
      type: options.itemClass ?? getApiType(),
      isArray: true,
    }

    if (options.minLength !== undefined) {
      apiPropertyOptions.minItems = options.minLength
    }
    if (options.maxLength !== undefined) {
      apiPropertyOptions.maxItems = options.maxLength
    }

    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
