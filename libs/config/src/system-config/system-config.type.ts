import type { SystemConfig } from './config-reader'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K]
}

/**
 * 系统配置更新入参。
 * - 仅允许更新 DEFAULT_CONFIG 声明的配置节点
 */
export type UpdateSystemConfigInput = DeepPartial<SystemConfig>

/**
 * 系统配置对象节点值。
 * - 用于字段过滤与递归处理
 */
export type ConfigNodeValue = Record<string, unknown> | undefined

/**
 * 系统配置白名单模板。
 * - 与 DEFAULT_CONFIG 结构保持一致
 */
export type ConfigAllowedTemplate = Record<string, unknown>

/**
 * 敏感字段处理输入。
 * - input 为本次提交数据
 * - current 为当前配置数据
 */
export interface SensitiveFieldProcessInput {
  input: Record<string, unknown>
  current: Record<string, unknown> | null
  sensitivePaths: string[]
}
