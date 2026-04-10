import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { EnumArrayPropertyOptions } from './types'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsOptional,
} from 'class-validator'
import {
  createEnumValueValidator,
  normalizeEnumArrayItem,
  resolveEnumValidationArtifacts,
} from './enum-shared'
import { buildContractPropertyDecorators } from './contract'

/**
 * 枚举数组属性装饰器
 *
 * @description 用于定义枚举数组字段，支持字符串/数字枚举、长度限制和类型转换
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function EnumArrayProperty(options: EnumArrayPropertyOptions) {
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)
  const required = options.required ?? true
  const enumArtifacts = resolveEnumValidationArtifacts(options.enum)

  if (
    options.minLength !== undefined &&
    options.maxLength !== undefined &&
    options.minLength > options.maxLength
  ) {
    throw new Error('EnumArrayProperty: minLength 不能大于 maxLength')
  }

  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(
      IsArray({ message: '必须是数组类型' }),
      createEnumValueValidator(options.enum, enumArtifacts, {
        each: true,
        message: `数组中的元素必须是有效的枚举值: ${enumArtifacts.validValues.join(', ')}`,
      }),
    )

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

        if (!Array.isArray(value)) {
          return value
        }

        return value.map(item => normalizeEnumArrayItem(item, enumArtifacts))
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
        enum: options.enum,
        isArray: true,
        type: enumArtifacts.isNumericEnum ? Number : String,
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
