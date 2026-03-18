/**
 * 用户等级规则模块常量定义
 */

/**
 * 等级规则权限类型枚举
 */
export enum UserLevelRulePermissionEnum {
  /** 每日发帖数量上限 */
  DAILY_TOPIC_LIMIT = 'dailyTopicLimit',
  /** 每日回复和评论数量上限 */
  DAILY_REPLY_COMMENT_LIMIT = 'dailyReplyCommentLimit',
  /** 发帖间隔秒数 */
  POST_INTERVAL = 'postInterval',
  /** 每日点赞次数上限 */
  DAILY_LIKE_LIMIT = 'dailyLikeLimit',
  /** 每日收藏次数上限 */
  DAILY_FAVORITE_LIMIT = 'dailyFavoriteLimit',
}
