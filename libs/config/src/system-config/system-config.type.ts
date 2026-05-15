import type { DEFAULT_CONFIG } from './system-config.constant'

/** 系统配置类型（从 DEFAULT_CONFIG 推断）。 */
export type SystemConfig = typeof DEFAULT_CONFIG

/** 三方资源解析配置类型，运行时读取侧始终返回完整安全值。 */
export type ThirdPartyResourceParseConfig =
  SystemConfig['thirdPartyResourceParseConfig']

/**
 * 系统配置白名单模板。
 * - 与 DEFAULT_CONFIG 结构保持一致
 */
/** 稳定领域类型 `ConfigAllowedTemplate`。仅供内部领域/服务链路复用，避免重复定义。 */
export type ConfigAllowedTemplate = Record<string, unknown>
