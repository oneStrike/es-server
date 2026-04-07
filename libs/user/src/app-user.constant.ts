/**
 * APP 用户默认值常量。
 * 用于注册与资料初始化阶段的稳定默认口径。
 */
export const UserDefaults = {
  /** 初始积分 */
  INITIAL_POINTS: 0,
  /** 初始经验值 */
  INITIAL_EXPERIENCE: 0,
}

/**
 * APP 用户状态枚举。
 * 收敛登录、发帖、评论等能力判断所依赖的统一状态语义。
 */
export enum UserStatusEnum {
  /** 正常 */
  NORMAL = 1,
  /** 禁言 */
  MUTED = 2,
  /** 永久禁言 */
  PERMANENT_MUTED = 3,
  /** 封禁 */
  BANNED = 4,
  /** 永久封禁 */
  PERMANENT_BANNED = 5,
}

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
