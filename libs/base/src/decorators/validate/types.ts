import type { TransformFnParams } from 'class-transformer'

/**
 * 基础验证选项接口
 */
export interface BaseValidateOptions {
  /** 字段描述，用于API文档 */
  description: string
  /** 是否必填，默认为true */
  required?: boolean
  /** 自定义转换函数 */
  transform?: (params: TransformFnParams) => any
}

/**
 * 字符串属性选项
 */
export interface StringPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: string | null
  /** 默认值 */
  default?: string
  /** 字符串类型，支持ISO8601日期格式 */
  type?: 'ISO8601'
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
  example?: number
  /** 最大值 */
  max?: number
  /** 最小值 */
  min?: number
  /** 默认值 */
  default?: number
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
export interface ArrayPropertyOptions<T = any> extends BaseValidateOptions {
  /** 示例值 */
  example?: T[]
  /** 数组最大长度 */
  maxLength?: number
  /** 数组最小长度 */
  minLength?: number
  /** 默认值 */
  default?: T[]
  /** 数组元素类型 */
  itemType: 'string' | 'number' | 'boolean' | 'object'
  /** 数组元素DTO类型（用于API文档） */
  itemClass?: new (...args: any[]) => any
  /** 数组元素验证器（可选，用于复杂类型验证） */
  itemValidator?: (value: any) => boolean
  /** 数组元素验证失败时的错误消息 */
  itemErrorMessage?: string
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
  type: new (...args: any[]) => any
  /** 示例值 */
  example?: any
  /** 默认值 */
  default?: any
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
 * 数字枚举类型定义
 * 专门用于位掩码验证，支持TypeScript数字枚举的双向映射
 * 允许字符串键映射到数字值，数字键映射到字符串值（反向映射）
 */
export type NumberEnumLike =
  | Record<string, number>
  | Record<number, string>
  | (Record<string, number> & Record<number, string>)

/**
 * 枚举属性选项
 */
export interface EnumPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: any
  /** 枚举对象，支持字符串和数字枚举 */
  enum: EnumLike
  /** 默认值 */
  default?: any
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}

/**
 * 位掩码属性选项
 */
export interface BitmaskPropertyOptions extends BaseValidateOptions {
  /** 示例值 */
  example?: number
  /** 枚举对象，必须为数字枚举 */
  enum: NumberEnumLike
  /** 默认值 */
  default?: number
  /** 是否启用校验，默认为true。设置为false时仅使用ApiProperty */
  validation?: boolean
}
