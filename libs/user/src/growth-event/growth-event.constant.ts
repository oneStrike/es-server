/**
 * 用户成长事件常量定义
 * 统一事件总线标识与审计策略配置
 */
/// 事件总线注入标识
export const USER_GROWTH_EVENT_BUS = 'USER_GROWTH_EVENT_BUS'
/// 幂等窗口（秒）
export const USER_GROWTH_EVENT_IDEMPOTENCY_WINDOW_SECONDS = 300
/// 审计保留天数
export const USER_GROWTH_EVENT_AUDIT_RETENTION_DAYS = 180
/// 审计归档批处理大小
export const USER_GROWTH_EVENT_AUDIT_ARCHIVE_BATCH_SIZE = 500

/**
 * 成长事件处理状态枚举
 */
export enum UserGrowthEventStatus {
  /** 待处理 */
  PENDING = 'PENDING',
  /** 已处理 */
  PROCESSED = 'PROCESSED',
  /** 被反作弊拒绝 */
  REJECTED_ANTIFRAUD = 'REJECTED_ANTIFRAUD',
  /** 规则不存在而忽略 */
  IGNORED_RULE_NOT_FOUND = 'IGNORED_RULE_NOT_FOUND',
  /** 幂等重复而忽略 */
  IGNORED_DUPLICATE = 'IGNORED_DUPLICATE',
  /** 处理失败 */
  FAILED = 'FAILED',
}
