import type { JsonObject, JsonValue } from '@libs/platform/utils/jsonParse'
import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { TransformFnParams } from 'class-transformer'

/**
 * 基础验证选项接口
 */
export interface BaseValidateOptions {
  /** 字段描述，用于API文档 */
  description: string
  /** 是否必填，默认为true */
  required?: boolean
  /** 是否属于对外 HTTP 契约，默认为 true。设置为 false 时隐藏文档并在请求阶段静默过滤 */
  contract?: boolean
  /** 自定义转换函数 */
  transform?: (params: TransformFnParams) => TransformFnParams['value']
}

/**
 * 字符串属性选项
 */
export interface StringPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | null
  /** 默认值 */
  default?: string | null
  /** 是否允许为 null（仅影响文档表现） */
  nullable?: boolean
  /** 字符串类型，支持ISO8601日期格式 */
  type?: 'ISO8601' | 'url'
  /** 最大长度 */
  maxLength?: number
  /** 最小长度 */
  minLength?: number
  /** 是否为强密码验证 */
  password?: boolean
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 数字属性选项
 */
export interface NumberPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: number | null
  /** 最大值 */
  max?: number
  /** 最小值 */
  min?: number
  /** 默认值 */
  default?: number | null
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 数字数组属性选项
 */
export interface NumberArrayPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: number[]
  /** 数组最大长度 */
  maxLength?: number
  /** 数组最小长度 */
  minLength?: number
  /** 默认值 */
  default?: number[]
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 通用数组属性选项
 */
interface PrimitiveArrayPropertyShape {
  /** 数组元素类型 */
  itemType: 'string' | 'number' | 'boolean'
  /** 基础类型不需要 itemClass */
  itemClass?: never
  /** 基础类型数组不需要 itemEnum */
  itemEnum?: never
}

interface ClassArrayPropertyShape<T> {
  /** 数组元素DTO类型（必传，用于深度校验和API文档） */
  itemClass: new (...args: never[]) => T
  /** 对象数组不再通过 itemType 指定 */
  itemType?: never
  /** DTO 数组不需要 itemEnum */
  itemEnum?: never
}

interface EnumValueArrayPropertyShape {
  /** 枚举数组元素 */
  itemEnum: EnumLike
  /** 枚举数组不需要 itemType */
  itemType?: never
  /** 枚举数组不需要 itemClass */
  itemClass?: never
}

type ArrayPropertyShape<T> =
  | PrimitiveArrayPropertyShape
  | ClassArrayPropertyShape<T>
  | EnumValueArrayPropertyShape

export type ArrayPropertyOptions<T = string | number | boolean> =
  BaseValidateOptions & {
    /** 示例值 */
    example?: T[]
    /** 数组最大长度 */
    maxLength?: number
    /** 数组最小长度 */
    minLength?: number
    /** 默认值 */
    default?: T[]
    /** 数组元素验证器（可选，用于复杂类型验证） */
    itemValidator?: (value: T) => boolean
    /** 数组元素验证失败时的错误消息 */
    itemErrorMessage?: string
    /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
    validation?: boolean
  } & ArrayPropertyShape<T>

/**
 * 枚举数组属性选项
 */
export interface EnumArrayPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: Array<string | number>
  /** 数组最大长度 */
  maxLength?: number
  /** 数组最小长度 */
  minLength?: number
  /** 默认值 */
  default?: Array<string | number>
  /** 枚举对象，支持字符串和数字枚举 */
  enum: EnumLike
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 日期属性选项
 */
export interface DatePropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | Date | null
  /** 默认值 */
  default?: Date | null
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 布尔值属性选项
 */
export interface BooleanPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: boolean
  /** 默认值 */
  default?: boolean
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 嵌套对象属性选项
 */
export interface NestedPropertyOptions extends BaseValidateOptions {
  /** 嵌套对象的类型（类构造函数） */
  type: new (...args: never[]) => object
  /** 示例值 */
  example?: JsonValue | null
  /** 默认值 */
  default?: JsonValue | null
  /** 是否允许为 null（仅影响文档表现） */
  nullable?: boolean
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * JSON属性选项
 */
export interface JsonPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | object | null
  /** 默认值 */
  default?: string
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 开放对象属性选项
 */
export interface ObjectPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: JsonObject | null
  /** 默认值 */
  default?: JsonObject | null
  /** OpenAPI additionalProperties 配置，默认 true */
  additionalProperties?: ApiPropertyOptions['additionalProperties']
  /** 是否允许为 null（仅影响文档表现） */
  nullable?: boolean
  /** 是否启用校验，默认为 true。设置为 false 时仅使用 ApiProperty */
  validation?: boolean
}

/**
 * 正则表达式属性选项
 */
export interface RegexPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | null
  /** 默认值 */
  default?: string
  /** 正则表达式 */
  regex: RegExp
  /** 验证失败时的错误消息 */
  message?: string
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 枚举类型定义
 * 支持TypeScript原生枚举和手动定义的枚举对象
 */
export type EnumLike = Record<string | number, string | number>

/**
 * 枚举属性选项
 */
export interface EnumPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | number | null
  /** 枚举对象，支持字符串和数字枚举 */
  enum: EnumLike
  /** 默认值 */
  default?: string | number | null
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}
