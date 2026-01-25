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

/**
 * 论坛用户档案默认值
 */
export const ForumProfileDefaults = {
  /** 活跃状态 */
  STATUS_ACTIVE: 1,
  /** 初始积分 */
  INITIAL_POINTS: 0,
  /** 初始经验值 */
  INITIAL_EXPERIENCE: 0,
  /** 初始主题数 */
  INITIAL_TOPIC_COUNT: 0,
  /** 初始回复数 */
  INITIAL_REPLY_COUNT: 0,
  /** 初始点赞数 */
  INITIAL_LIKE_COUNT: 0,
  /** 初始收藏数 */
  INITIAL_FAVORITE_COUNT: 0,
  /** 默认签名 */
  DEFAULT_SIGNATURE: '这是我的个人签名',
  /** 默认个人简介 */
  DEFAULT_BIO: '这是我的个人简介',
}
