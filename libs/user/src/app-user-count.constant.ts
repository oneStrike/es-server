/**
 * 用户计数增减失败原因码。
 * 继承旧计数 helper 的公开 cause.code 语义，但限定在用户计数 owner 内。
 */
export const AppUserCountDeltaFailureCauseCode = {
  // 用户计数行不存在或不在当前可更新作用域内。
  TARGET_NOT_FOUND: 'count_delta_target_not_found',
  // 负数扣减会导致计数小于 0。
  INSUFFICIENT_COUNT: 'count_delta_insufficient_count',
} as const
