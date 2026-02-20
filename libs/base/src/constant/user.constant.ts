/**
 * 用户常量定义
 * 覆盖默认值与用户状态枚举
 */
/**
 * 用户默认值常量
 */
export const UserDefaults = {
  /** 初始积分 */
  INITIAL_POINTS: 0,
  /** 初始经验值 */
  INITIAL_EXPERIENCE: 0,
}

/**
 * 用户状态枚举
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
