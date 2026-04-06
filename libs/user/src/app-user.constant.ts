/**
 * APP 用户删除态筛选范围。
 * 用于后台分页列表在未删除、已删除与全部之间切换。
 */
export enum AppUserDeletedScopeEnum {
  /** 未删除 */
  ACTIVE = 0,
  /** 已删除 */
  DELETED = 1,
  /** 全部 */
  ALL = 2,
}

/**
 * APP 用户后台人工操作稳定键格式。
 * 用于积分/经验人工补发、扣减等幂等操作。
 */
export const APP_USER_MANUAL_OPERATION_KEY_REGEX = /^[\w:-]{8,64}$/
