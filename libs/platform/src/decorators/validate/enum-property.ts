import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { EnumPropertyOptions } from './types'
import { getNumberEnumValues, isDevelopment, isNumberEnum } from '@libs/platform/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsOptional } from 'class-validator'

const DESCRIPTION_HAS_ENUM_MAPPING_REGEX = /[（(][^)=\uFF09\uFF1D]*[=\uFF1D][^)\uFF09]*[）)]/
const DESCRIPTION_MAPPING_SEGMENT_REGEX = /[（(]([^()（）=＝]*[=＝][^()（）]*)[）)]/g
const NUMERIC_KEY_REGEX = /^\d+$/
const ENUM_MAPPING_PAIR_REGEX = /([^\s=＝，,；;、:：()（）]+)\s*[=＝]\s*([^\s=＝，,；;、:：()（）]+)/g

function getEnumItems(enumObj: EnumPropertyOptions['enum']) {
  return Object.entries(enumObj).filter(([key, value]) => {
    if (NUMERIC_KEY_REGEX.test(key)) {
      return false
    }
    return typeof value === 'string' || typeof value === 'number'
  })
}

function getDescriptionMappingValues(description: string) {
  const segments = [...description.matchAll(DESCRIPTION_MAPPING_SEGMENT_REGEX)]
  if (segments.length === 0) {
    return null
  }

  return segments
    .map((segment) => [...segment[1].matchAll(ENUM_MAPPING_PAIR_REGEX)])
    .filter((pairs) => pairs.length > 0)
    .map((pairs) => pairs.map((pair) => ({
      left: pair[1].trim(),
      right: pair[2].trim(),
    })))
}

function validateDescriptionMapping(description: string, enumObj: EnumPropertyOptions['enum']) {
  const mappingGroups = getDescriptionMappingValues(description)
  if (!mappingGroups) {
    return
  }

  const enumValues = new Set(getEnumItems(enumObj).map(([, value]) => String(value)))

  for (const mappings of mappingGroups) {
    const leftValues = new Set(mappings.map((item) => item.left))
    const rightValues = new Set(mappings.map((item) => item.right))
    const leftHasEnumValue = [...leftValues].some((value) => enumValues.has(value))
    const rightHasEnumValue = [...rightValues].some((value) => enumValues.has(value))

    if (!leftHasEnumValue && !rightHasEnumValue) {
      continue
    }

    const leftIsEnumValues = [...leftValues].every((value) => enumValues.has(value))
    const rightIsEnumValues = [...rightValues].every((value) => enumValues.has(value))

    if (!leftIsEnumValues && !rightIsEnumValues) {
      throw new Error(`EnumProperty: description 枚举映射与 enum 不匹配: ${description}`)
    }

    const descriptionEnumValues = leftIsEnumValues ? leftValues : rightValues

    for (const enumValue of enumValues) {
      if (!descriptionEnumValues.has(enumValue)) {
        throw new Error(
          `EnumProperty: description 缺少枚举值 ${enumValue} 的说明: ${description}`,
        )
      }
    }

    return
  }
}

function getEnumDescription(description: string, enumObj: EnumPropertyOptions['enum']) {
  if (DESCRIPTION_HAS_ENUM_MAPPING_REGEX.test(description)) {
    return description
  }

  const enumItems = getEnumItems(enumObj)

  if (enumItems.length === 0) {
    return description
  }

  const enumDescription = enumItems.map(([key, value]) => `${value}=${key}`).join('，')
  return `${description}（${enumDescription}）`
}

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

  if (isDevelopment()) {
    validateDescriptionMapping(options.description, options.enum)
  }

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
      description: getEnumDescription(options.description, options.enum),
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
