/**
 * Growth rule type enum shared by points and experience rules.
 */
export enum GrowthRuleTypeEnum {
  // Forum
  CREATE_TOPIC = 1,
  CREATE_REPLY = 2,
  TOPIC_LIKED = 3,
  REPLY_LIKED = 4,
  TOPIC_FAVORITED = 5,
  DAILY_CHECK_IN = 6,
  ADMIN = 7,
  TOPIC_VIEW = 8,
  TOPIC_REPORT = 9,
  /** 帖子被评论 */
  TOPIC_COMMENT = 16,

  // Comment
  CREATE_COMMENT = 10,
  COMMENT_LIKED = 11,
  COMMENT_REPORT = 12,

  // Comic work
  COMIC_WORK_VIEW = 100,
  COMIC_WORK_LIKE = 101,
  COMIC_WORK_FAVORITE = 102,
  COMIC_WORK_REPORT = 103,
  /** 漫画作品评论 */
  COMIC_WORK_COMMENT = 104,

  // Novel work
  NOVEL_WORK_VIEW = 200,
  NOVEL_WORK_LIKE = 201,
  NOVEL_WORK_FAVORITE = 202,
  NOVEL_WORK_REPORT = 203,
  /** 小说作品评论 */
  NOVEL_WORK_COMMENT = 204,

  // Comic chapter
  COMIC_CHAPTER_READ = 300,
  COMIC_CHAPTER_LIKE = 301,
  COMIC_CHAPTER_PURCHASE = 302,
  COMIC_CHAPTER_DOWNLOAD = 303,
  COMIC_CHAPTER_EXCHANGE = 304,
  COMIC_CHAPTER_REPORT = 305,
  /** 漫画章节评论 */
  COMIC_CHAPTER_COMMENT = 306,

  // Novel chapter
  NOVEL_CHAPTER_READ = 400,
  NOVEL_CHAPTER_LIKE = 401,
  NOVEL_CHAPTER_PURCHASE = 402,
  NOVEL_CHAPTER_DOWNLOAD = 403,
  NOVEL_CHAPTER_EXCHANGE = 404,
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
  REPORT_VALID = 800,
  REPORT_INVALID = 801,
}

/**
 * Human-readable names for growth rules.
 */
export const GrowthRuleTypeNames: Record<GrowthRuleTypeEnum, string> = {
  [GrowthRuleTypeEnum.CREATE_TOPIC]: '发表主题',
  [GrowthRuleTypeEnum.CREATE_REPLY]: '发表回复',
  [GrowthRuleTypeEnum.TOPIC_LIKED]: '主题被点赞',
  [GrowthRuleTypeEnum.REPLY_LIKED]: '回复被点赞',
  [GrowthRuleTypeEnum.TOPIC_FAVORITED]: '主题被收藏',
  [GrowthRuleTypeEnum.DAILY_CHECK_IN]: '每日签到',
  [GrowthRuleTypeEnum.ADMIN]: '管理员操作',
  [GrowthRuleTypeEnum.TOPIC_VIEW]: '主题浏览',
  [GrowthRuleTypeEnum.TOPIC_REPORT]: '举报主题',
  [GrowthRuleTypeEnum.TOPIC_COMMENT]: '主题被评论',
  [GrowthRuleTypeEnum.CREATE_COMMENT]: '发表评论',
  [GrowthRuleTypeEnum.COMMENT_LIKED]: '评论被点赞',
  [GrowthRuleTypeEnum.COMMENT_REPORT]: '举报评论',
  [GrowthRuleTypeEnum.COMIC_WORK_VIEW]: '漫画浏览',
  [GrowthRuleTypeEnum.COMIC_WORK_LIKE]: '漫画点赞',
  [GrowthRuleTypeEnum.COMIC_WORK_FAVORITE]: '漫画收藏',
  [GrowthRuleTypeEnum.COMIC_WORK_REPORT]: '举报漫画',
  [GrowthRuleTypeEnum.COMIC_WORK_COMMENT]: '漫画评论',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_READ]: '章节阅读',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE]: '章节点赞',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_PURCHASE]: '章节购买',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD]: '章节下载',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_EXCHANGE]: '章节兑换',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_REPORT]: '举报章节',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_COMMENT]: '章节评论',
  [GrowthRuleTypeEnum.NOVEL_WORK_VIEW]: '小说浏览',
  [GrowthRuleTypeEnum.NOVEL_WORK_LIKE]: '小说点赞',
  [GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE]: '小说收藏',
  [GrowthRuleTypeEnum.NOVEL_WORK_REPORT]: '举报小说',
  [GrowthRuleTypeEnum.NOVEL_WORK_COMMENT]: '小说评论',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_READ]: '小说章节阅读',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_LIKE]: '小说章节点赞',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_PURCHASE]: '小说章节购买',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_DOWNLOAD]: '小说章节下载',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_EXCHANGE]: '小说章节兑换',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_REPORT]: '举报小说章节',
  [GrowthRuleTypeEnum.NOVEL_CHAPTER_COMMENT]: '小说章节评论',
  [GrowthRuleTypeEnum.BADGE_EARNED]: '获得徽章',
  [GrowthRuleTypeEnum.PROFILE_COMPLETE]: '完善资料',
  [GrowthRuleTypeEnum.AVATAR_UPLOAD]: '上传头像',
  [GrowthRuleTypeEnum.FOLLOW_USER]: '关注用户',
  [GrowthRuleTypeEnum.BE_FOLLOWED]: '被关注',
  [GrowthRuleTypeEnum.SHARE_CONTENT]: '分享内容',
  [GrowthRuleTypeEnum.INVITE_USER]: '邀请用户',
  [GrowthRuleTypeEnum.REPORT_VALID]: '举报有效',
  [GrowthRuleTypeEnum.REPORT_INVALID]: '举报无效',
}

export function getGrowthRuleTypeName(type: GrowthRuleTypeEnum): string {
  return GrowthRuleTypeNames[type] ?? '未知规则'
}
