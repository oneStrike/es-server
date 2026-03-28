/**
 * 积分与经验共享的成长规则编码。
 * 当前统一以该枚举作为奖励规则的稳定编码层。
 * 完整事件元数据请通过 event-definition 模块读取，避免继续在 DTO 和文档里复制长枚举说明。
 */
export enum GrowthRuleTypeEnum {
  // Forum
  /** 发帖奖励。无需审核时即时结算；进入待审核时在首次通过后补发。 */
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  TOPIC_LIKED = 3,
  REPLY_LIKED = 4,
  TOPIC_FAVORITED = 5,
  DAILY_CHECK_IN = 6,
  ADMIN = 7,
  TOPIC_VIEW = 8,
  /** 历史兼容：主题举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  TOPIC_REPORT = 9,
  /** 帖子被评论 */
  TOPIC_COMMENT = 16,

  // Comment
  CREATE_COMMENT = 10,
  COMMENT_LIKED = 11,
  /** 历史兼容：评论举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  COMMENT_REPORT = 12,

  // Comic work
  COMIC_WORK_VIEW = 100,
  COMIC_WORK_LIKE = 101,
  COMIC_WORK_FAVORITE = 102,
  /** 历史兼容：作品举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  COMIC_WORK_REPORT = 103,
  /** 漫画作品评论 */
  COMIC_WORK_COMMENT = 104,

  // Novel work
  NOVEL_WORK_VIEW = 200,
  NOVEL_WORK_LIKE = 201,
  NOVEL_WORK_FAVORITE = 202,
  /** 历史兼容：作品举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  NOVEL_WORK_REPORT = 203,
  /** 小说作品评论 */
  NOVEL_WORK_COMMENT = 204,

  // Comic chapter
  COMIC_CHAPTER_READ = 300,
  COMIC_CHAPTER_LIKE = 301,
  COMIC_CHAPTER_PURCHASE = 302,
  COMIC_CHAPTER_DOWNLOAD = 303,
  COMIC_CHAPTER_EXCHANGE = 304,
  /** 历史兼容：章节举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  COMIC_CHAPTER_REPORT = 305,
  /** 漫画章节评论 */
  COMIC_CHAPTER_COMMENT = 306,

  // Novel chapter
  NOVEL_CHAPTER_READ = 400,
  NOVEL_CHAPTER_LIKE = 401,
  NOVEL_CHAPTER_PURCHASE = 402,
  NOVEL_CHAPTER_DOWNLOAD = 403,
  NOVEL_CHAPTER_EXCHANGE = 404,
  /** 历史兼容：章节举报提交即奖励口径，当前正式链路改为裁决后奖励。 */
  NOVEL_CHAPTER_REPORT = 405,
  /** 小说章节评论 */
  NOVEL_CHAPTER_COMMENT = 406,

  // Badge & Achievement
  BADGE_EARNED = 600,
  PROFILE_COMPLETE = 601,
  AVATAR_UPLOAD = 602,

  // Social interaction
  FOLLOW_USER = 700,
  BE_FOLLOWED = 701,
  SHARE_CONTENT = 702,
  INVITE_USER = 703,

  // Report handling
  /** 举报裁决有效后的正式奖励口径。 */
  REPORT_VALID = 800,
  /** 举报裁决无效后的正式奖励口径。 */
  REPORT_INVALID = 801,
}

/**
 * 成长规则英文键名。
 * 供事件定义层等元数据模块复用稳定 key。
 */
export type GrowthRuleTypeKey = keyof typeof GrowthRuleTypeEnum

/**
 * 成长规则的稳定数值编码列表。
 * 用于事件定义覆盖校验、配置筛选和枚举遍历，避免受 TS 数字枚举反向映射影响。
 */
export const GROWTH_RULE_TYPE_VALUES = Object.values(GrowthRuleTypeEnum).filter(
  (value): value is GrowthRuleTypeEnum => typeof value === 'number',
)
