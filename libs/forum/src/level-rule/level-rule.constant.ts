/**
 * 论坛等级规则模块常量定义
 */

/**
 * 等级规则权限类型枚举
 */
export enum LevelRulePermissionEnum {
  /** 每日发帖数量上限 */
  DAILY_TOPIC_LIMIT = 'dailyTopicLimit',
  /** 每日回复数量上限 */
  DAILY_REPLY_LIMIT = 'dailyReplyLimit',
  /** 发帖间隔秒数 */
  POST_INTERVAL = 'postInterval',
  /** 单个文件最大大小 */
  MAX_FILE_SIZE = 'maxFileSize',
  /** 每日点赞次数上限 */
  DAILY_LIKE_LIMIT = 'dailyLikeLimit',
  /** 每日收藏次数上限 */
  DAILY_FAVORITE_LIMIT = 'dailyFavoriteLimit',
  /** 每日评论次数上限 */
  DAILY_COMMENT_LIMIT = 'dailyCommentLimit',
}

/**
 * 等级规则权限名称映射
 */
export const LevelRulePermissionNames: Record<LevelRulePermissionEnum, string> =
  {
    [LevelRulePermissionEnum.DAILY_TOPIC_LIMIT]: '每日发帖数量上限',
    [LevelRulePermissionEnum.DAILY_REPLY_LIMIT]: '每日回复数量上限',
    [LevelRulePermissionEnum.POST_INTERVAL]: '发帖间隔秒数',
    [LevelRulePermissionEnum.MAX_FILE_SIZE]: '单个文件最大大小(KB)',
    [LevelRulePermissionEnum.DAILY_LIKE_LIMIT]: '每日点赞次数上限',
    [LevelRulePermissionEnum.DAILY_FAVORITE_LIMIT]: '每日收藏次数上限',
    [LevelRulePermissionEnum.DAILY_COMMENT_LIMIT]: '每日评论次数上限',
  }
