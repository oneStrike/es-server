/**
 * 用户状态枚举
 */
export enum ForumProfileStatusEnum {
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

export const ForumProfileDefaults = {
  STATUS_ACTIVE: 1,
  INITIAL_POINTS: 0,
  INITIAL_EXPERIENCE: 0,
  INITIAL_TOPIC_COUNT: 0,
  INITIAL_REPLY_COUNT: 0,
  INITIAL_LIKE_COUNT: 0,
  INITIAL_FAVORITE_COUNT: 0,
  DEFAULT_SIGNATURE: '这是我的个人签名',
  DEFAULT_BIO: '这是我的个人简介',
}
