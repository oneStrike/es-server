/**
 * 系统配置白名单模板。
 * - 与 DEFAULT_CONFIG 结构保持一致
 */
/** 稳定领域类型 `ConfigAllowedTemplate`。仅供内部领域/服务链路复用，避免重复定义。 */
export type ConfigAllowedTemplate = Record<string, unknown>
