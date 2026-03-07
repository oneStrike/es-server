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
  REPORT_CREATE = 9,

  // Comment
  CREATE_COMMENT = 10,
  COMMENT_LIKED = 11,

  // Comic work
  COMIC_WORK_VIEW = 100,
  COMIC_WORK_LIKE = 101,
  COMIC_WORK_FAVORITE = 102,

  // Novel work
  NOVEL_WORK_VIEW = 200,
  NOVEL_WORK_LIKE = 201,
  NOVEL_WORK_FAVORITE = 202,

  // Comic chapter
  COMIC_CHAPTER_READ = 300,
  COMIC_CHAPTER_LIKE = 301,
  COMIC_CHAPTER_PURCHASE = 302,
  COMIC_CHAPTER_DOWNLOAD = 303,
  COMIC_CHAPTER_EXCHANGE = 304,
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
  [GrowthRuleTypeEnum.REPORT_CREATE]: '举报',
  [GrowthRuleTypeEnum.CREATE_COMMENT]: '发表评论',
  [GrowthRuleTypeEnum.COMMENT_LIKED]: '评论被点赞',
  [GrowthRuleTypeEnum.COMIC_WORK_VIEW]: '漫画浏览',
  [GrowthRuleTypeEnum.COMIC_WORK_LIKE]: '漫画点赞',
  [GrowthRuleTypeEnum.COMIC_WORK_FAVORITE]: '漫画收藏',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_READ]: '章节阅读',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE]: '章节点赞',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_PURCHASE]: '章节购买',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD]: '章节下载',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_EXCHANGE]: '章节兑换',
  [GrowthRuleTypeEnum.NOVEL_WORK_VIEW]: '小说浏览',
  [GrowthRuleTypeEnum.NOVEL_WORK_LIKE]: '小说点赞',
  [GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE]: '小说收藏',
}

export function getGrowthRuleTypeName(type: GrowthRuleTypeEnum): string {
  return GrowthRuleTypeNames[type] ?? '未知规则'
}
