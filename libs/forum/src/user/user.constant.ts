/**
 * 用户等级枚举
 */
export enum UserLevelEnum {
  /** 新手 */
  NEWBIE = 1,
  /** 初级 */
  JUNIOR = 2,
  /** 中级 */
  INTERMEDIATE = 3,
  /** 高级 */
  SENIOR = 4,
  /** 专家 */
  EXPERT = 5,
}

/**
 * 用户等级名称映射
 */
export const UserLevelNames: Record<UserLevelEnum, string> = {
  [UserLevelEnum.NEWBIE]: '新手',
  [UserLevelEnum.JUNIOR]: '初级',
  [UserLevelEnum.INTERMEDIATE]: '中级',
  [UserLevelEnum.SENIOR]: '高级',
  [UserLevelEnum.EXPERT]: '专家',
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
