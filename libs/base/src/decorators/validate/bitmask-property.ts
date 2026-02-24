import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { BitmaskPropertyOptions } from './types'
import { isDevelopment, isNumberEnum } from '@libs/base/utils'
import { applyDecorators } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsNumber,
  IsOptional,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { NumberEnumLike } from './types'

/**
 * 位掩码验证器
 *
 * @description 用于验证位掩码值是否为指定枚举的有效组合
 */
@ValidatorConstraint({ name: 'bitmask', async: false })
export class BitmaskValidator implements ValidatorConstraintInterface {
  /**
   * 验证位掩码值
   * @param value 待验证的值
   * @param args 验证参数
   * @returns 验证结果
   */
  validate(value: any, args: ValidationArguments): boolean {
    const [enumObject] = args.constraints as [NumberEnumLike]

    if (value === undefined || value === null) {
      return true
    }

    const numValue = typeof value === 'string' ? Number(value) : value

    if (Number.isNaN(numValue)) {
      return false
    }

    if (!Number.isInteger(numValue) || numValue < 0) {
      return false
    }

    const enumValues = Object.values(enumObject).filter(
      (enumValue): enumValue is number => typeof enumValue === 'number',
    )

    if (enumValues.length === 0) {
      return false
    }

    const validBits = enumValues.reduce((acc, enumValue) => acc | enumValue, 0)

    return (numValue & ~validBits) === 0
  }

  /**
   * 获取默认错误消息
   * @param args 验证参数
   * @returns 错误消息
   */
  defaultMessage(args: ValidationArguments): string {
    const [enumObject] = args.constraints as [NumberEnumLike]
    const enumValues = Object.values(enumObject).filter(
      (enumValue): enumValue is number => typeof enumValue === 'number',
    )

    if (enumValues.length === 0) {
      return '无效的位掩码枚举配置'
    }

    const validBits = enumValues.reduce((acc, enumValue) => acc | enumValue, 0)
    const enumNames = Object.keys(enumObject).filter(
      (key) => typeof enumObject[key] === 'number',
    )

    return `位掩码值无效，有效范围: 0-${validBits}，可用选项: ${enumNames.join(', ')}`
  }
}

/**
 * 位掩码属性装饰器
 *
 * @description 用于定义位掩码值是否为指定数字枚举的有效组合
 * 可通过 validation 参数控制是否启用校验，设置为 false 时仅使用 ApiProperty
 *
 * @example
 * ```typescript
 * enum Permission {
 *   READ = 1,
 *   WRITE = 2,
 *   DELETE = 4,
 *   ADMIN = 8
 * }
 *
 * class CreateRoleDto {
 *   @BitmaskProperty({
 *     description: '权限位掩码',
 *     example: 7, // READ | WRITE | DELETE
 *     enum: Permission,
 *     required: true
 *   })
 *   permissions: number
 *
 *   @BitmaskProperty({
 *     description: '扩展权限',
 *     example: 0,
 *     enum: Permission,
 *     default: 0,
 *     required: false
 *   })
 *   extendedPermissions?: number
 * }
 * ```
 *
 * @param options 属性选项配置
 * @returns 装饰器函数
 */
export function BitmaskProperty(options: BitmaskPropertyOptions) {
  if (!options.enum) {
    throw new Error('BitmaskProperty: 枚举对象不能为空')
  }

  const validation = options.validation ?? true

  const decorators: any[] = []

  if (validation) {
    decorators.push(
      IsNumber({}, { message: '必须是数字类型' }),
      Validate(BitmaskValidator, [options.enum], {
        message: '位掩码值无效',
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

        if (value === undefined || value === null) {
          return value
        }

        if (typeof value === 'string') {
          const trimmedValue = value.trim()
          if (trimmedValue === '') {
            return undefined
          }
          const numValue = Number(trimmedValue)
          return Number.isNaN(numValue) ? value : numValue
        }

        return value
      }),
    )

    if (options.transform) {
      decorators.push(Transform(options.transform))
    }
  }

  if (isDevelopment()) {
    if (!isNumberEnum(options.enum)) {
      throw new Error('BitmaskProperty: 枚举对象必须为数字枚举')
    }

    const enumValues = Object.values(options.enum).filter(
      (value): value is number => typeof value === 'number',
    )
    const maxValue = enumValues.reduce((acc, value) => acc | value, 0)

    const apiPropertyOptions: ApiPropertyOptions = {
      description: options.description,
      example: options.example,
      required: options.required ?? true,
      default: options.default,
      nullable: !(options.required ?? true),
      type: Number,
      minimum: 0,
      maximum: maxValue,
    }

    decorators.push(ApiProperty(apiPropertyOptions))
  }

  return applyDecorators(...decorators)
}
