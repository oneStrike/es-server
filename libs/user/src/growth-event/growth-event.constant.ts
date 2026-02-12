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
