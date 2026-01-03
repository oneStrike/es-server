/**
 * 积分模块常量定义
 */

/// 积分规则类型枚举
export enum PointRuleTypeEnum {
  /** 发表主题 */
  CREATE_TOPIC = 1,
  /** 发表回复 */
  CREATE_REPLY = 2,
  /** 主题被点赞 */
  TOPIC_LIKED = 3,
  /** 回复被点赞 */
  REPLY_LIKED = 4,
  /** 主题被收藏 */
  TOPIC_FAVORITED = 5,
  /** 每日签到 */
  DAILY_CHECK_IN = 6,
}

/// 积分对象类型枚举
export enum PointObjectTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 回复 */
  REPLY = 2,
  /** 签到 */
  CHECK_IN = 3,
  /** 点赞 */
  LIKE = 4,
  /** 收藏 */
  FAVORITE = 5,
  /** 管理员操作 */
  ADMIN = 6,
}
