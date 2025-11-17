import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ValidateBitmaskOptions } from './types'
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
import { isNumberEnum } from '@/utils'
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

    // 空值由IsOptional处理
    if (value === undefined || value === null) {
      return true
    }

    // 转换为数字
    const numValue = typeof value === 'string' ? Number(value) : value

    // 检查是否为有效数字
    if (Number.isNaN(numValue)) {
      return false
    }

    // 检查是否为非负整数
    if (!Number.isInteger(numValue) || numValue < 0) {
      return false
    }

    // 获取枚举的所有数字值
    const enumValues = Object.values(enumObject).filter(
      (enumValue): enumValue is number => typeof enumValue === 'number',
    )

    // 如果没有数字枚举值，返回false
    if (enumValues.length === 0) {
      return false
    }

    // 计算所有有效位的组合
    const validBits = enumValues.reduce((acc, enumValue) => acc | enumValue, 0)

    // 检查是否包含无效位
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
 * 位掩码验证装饰器
 *
 * @description 用于验证位掩码值是否为指定数字枚举的有效组合
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
 *   @ValidateBitmask({
 *     description: '权限位掩码',
 *     example: 7, // READ | WRITE | DELETE
 *     enum: Permission,
 *     required: true
 *   })
 *   permissions: number
 *
 *   @ValidateBitmask({
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
 * @param options 验证选项配置
 * @returns 装饰器函数
 */
export function ValidateBitmask(options: ValidateBitmaskOptions) {
  // 参数验证
  if (!options.description) {
    throw new Error('ValidateBitmask: 描述信息不能为空')
  }

  if (!options.enum) {
    throw new Error('ValidateBitmask: 枚举对象不能为空')
  }

  if (!isNumberEnum(options.enum)) {
    throw new Error('ValidateBitmask: 枚举对象必须为数字枚举')
  }

  // 计算有效范围
  const enumValues = Object.values(options.enum).filter(
    (value): value is number => typeof value === 'number',
  )
  const maxValue = enumValues.reduce((acc, value) => acc | value, 0)

  // 构建API属性配置
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

  // 基础装饰器
  const decorators = [
    ApiProperty(apiPropertyOptions),
    IsNumber({}, { message: '必须是数字类型' }),
    Validate(BitmaskValidator, [options.enum], {
      message: '位掩码值无效',
    }),
  ]

  // 可选字段处理
  if (!(options.required ?? true)) {
    decorators.push(IsOptional())
  }

  // 转换逻辑
  decorators.push(
    Transform(({ value }) => {
      // 处理默认值
      if (
        (value === undefined || value === null) &&
        options.default !== undefined
      ) {
        return options.default
      }

      // 处理空值和可选字段
      if (value === undefined || value === null) {
        return value
      }

      // 字符串转数字
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

  // 自定义转换函数
  if (options.transform) {
    decorators.push(Transform(options.transform))
  }

  return applyDecorators(...decorators)
}
