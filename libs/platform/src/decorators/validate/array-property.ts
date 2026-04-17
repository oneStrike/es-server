import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ArrayPropertyOptions } from './types'
import { applyDecorators } from '@nestjs/common'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateBy,
  ValidateNested,
} from 'class-validator'
import { buildContractPropertyDecorators } from './contract'
import {
  createEnumValueValidator,
  normalizeEnumArrayItem,
  resolveEnumValidationArtifacts,
} from './enum-shared'

type PrimitiveArrayItemType = 'string' | 'number' | 'boolean'

interface PrimitiveArrayHelpers {
  apiType: StringConstructor | NumberConstructor | BooleanConstructor
  itemValidator: PropertyDecorator
  normalizeItem: (
    item: string | number | boolean | null | undefined,
  ) => string | number | boolean | null | undefined
}

function resolvePrimitiveItemType<TValue extends string | number | boolean>(
  options: ArrayPropertyOptions<TValue>,
): PrimitiveArrayItemType {
  if (options.itemType === undefined) {
    throw new Error('ArrayProperty: 基础类型数组必须提供 itemType')
  }

  return options.itemType
}

function createPrimitiveArrayHelpers<TValue extends string | number | boolean>(
  itemType: PrimitiveArrayItemType,
  options: ArrayPropertyOptions<TValue>,
): PrimitiveArrayHelpers {
  const itemErrorMessage = options.itemErrorMessage

  const helpersByType: Record<PrimitiveArrayItemType, PrimitiveArrayHelpers> = {
    string: {
      apiType: String,
      itemValidator: IsString({
        each: true,
        message: itemErrorMessage || '数组中的每个元素都必须是字符串类型',
      }),
      normalizeItem: (item) => (typeof item === 'string' ? item : String(item)),
    },
    number: {
      apiType: Number,
      itemValidator: IsNumber(
        {},
        {
          each: true,
          message: itemErrorMessage || '数组中的每个元素都必须是数字类型',
        },
      ),
      normalizeItem: (item) => {
        if (typeof item !== 'string') {
          return item
        }

        const trimmedItem = item.trim()
        if (trimmedItem === '') {
          return item
        }

        const numValue = Number(trimmedItem)
        return Number.isNaN(numValue) ? item : numValue
      },
    },
    boolean: {
      apiType: Boolean,
      itemValidator: IsBoolean({
        each: true,
        message: itemErrorMessage || '数组中的每个元素都必须是布尔类型',
      }),
      normalizeItem: (item) => {
        if (typeof item !== 'string') {
          return item
        }

        const lowerItem = item.toLowerCase().trim()
        if (lowerItem === 'true' || lowerItem === '1') {
          return true
        }

        if (lowerItem === 'false' || lowerItem === '0') {
          return false
        }

        return item
      },
    },
  }

  return helpersByType[itemType]
}

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
 *     itemClass: OrderConfigDto,
 *     example: [{ key: 'value' }],
 *     itemValidator: (value) => typeof value === 'object' && value !== null,
 *     itemErrorMessage: '数组中的每个元素都必须是有效的对象',
 *     required: true
 *   })
 *   configs: OrderConfigDto[]
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function ArrayProperty<T = string | number | boolean>(
  options: ArrayPropertyOptions<T>,
) {
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)
  const required = options.required ?? true
  const hasItemClass = Boolean(options.itemClass)
  const hasItemEnum = 'itemEnum' in options && Boolean(options.itemEnum)
  const enumLike = hasItemEnum ? options.itemEnum! : undefined
  const enumArtifacts = hasItemEnum
    ? resolveEnumValidationArtifacts(enumLike!)
    : undefined
  const primitiveHelpers =
    hasItemClass || hasItemEnum
      ? undefined
      : createPrimitiveArrayHelpers(
          resolvePrimitiveItemType(
            options as ArrayPropertyOptions<string | number | boolean>,
          ),
          options as ArrayPropertyOptions<string | number | boolean>,
        )

  if ((options as { itemType?: string }).itemType === 'object') {
    throw new Error(
      'ArrayProperty: 对象数组必须通过 itemClass 定义，不支持 itemType: object',
    )
  }

  if (
    options.minLength !== undefined &&
    options.maxLength !== undefined &&
    options.minLength > options.maxLength
  ) {
    throw new Error('ArrayProperty: minLength 不能大于 maxLength')
  }

  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(
      IsArray({ message: '必须是数组类型' }),
      enumArtifacts
        ? createEnumValueValidator(enumLike!, enumArtifacts, {
            each: true,
            message: `数组中的元素必须是有效的枚举值: ${enumArtifacts.validValues.join(', ')}`,
          })
        : primitiveHelpers
          ? primitiveHelpers.itemValidator
          : IsObject({
              each: true,
              message:
                options.itemErrorMessage || '数组中的每个元素都必须是对象类型',
            }),
    )

    if (hasItemClass && options.itemClass) {
      decorators.push(
        ValidateNested({ each: true }),
        Type(() => options.itemClass),
      )
    }

    if (options.itemValidator) {
      decorators.push(
        ValidateBy({
          name: 'customItemValidator',
          validator: {
            validate: (value: T[]) => {
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

    if (required) {
      decorators.push(ArrayNotEmpty({ message: '数组不能为空' }))
    }

    if (options.maxLength !== undefined) {
      decorators.push(
        ArrayMaxSize(options.maxLength, {
          message: `数组长度不能超过${options.maxLength}个元素`,
        }),
      )
    }

    if (options.minLength !== undefined) {
      decorators.push(
        ArrayMinSize(options.minLength, {
          message: `数组长度不能少于${options.minLength}个元素`,
        }),
      )
    }

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

        if (Array.isArray(value)) {
          return value.map((item) => {
            if (enumArtifacts) {
              return normalizeEnumArrayItem(item, enumArtifacts)
            }

            if (!primitiveHelpers) {
              if (typeof item === 'string') {
                try {
                  return JSON.parse(item)
                } catch {
                  return item
                }
              }

              return item
            }

            return primitiveHelpers.normalizeItem(item)
          })
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
        required,
        default: options.default,
        nullable: false,
        type:
          options.itemClass ??
          (enumArtifacts
            ? enumArtifacts.isNumericEnum
              ? Number
              : String
            : primitiveHelpers?.apiType) ??
            Object,
        isArray: true,
      }

      if (enumArtifacts) {
        apiPropertyOptions.enum = enumLike!
      }

      if (options.minLength !== undefined) {
        apiPropertyOptions.minItems = options.minLength
      }
      if (options.maxLength !== undefined) {
        apiPropertyOptions.maxItems = options.maxLength
      }

      return apiPropertyOptions
    }),
  )

  return applyDecorators(...decorators)
}
