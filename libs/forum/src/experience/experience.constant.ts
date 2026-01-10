/**
 * 经验模块常量定义
 */

/// 经验规则类型枚举
export enum ExperienceRuleTypeEnum {
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
  /** 管理员操作 */
  ADMIN = 7,
}
