/**
 * 用户成长规则类型枚举
 * 统一积分规则与经验规则的类型定义
 */

/**
 * 成长规则类型枚举
 * 同时用于积分规则和经验规则
 */
export enum GrowthRuleTypeEnum {
  // 论坛相关
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
  /** 主题浏览 */
  TOPIC_VIEW = 8,
  /** 举报 */
  REPORT_CREATE = 9,

  // 评论相关
  /** 发表评论 */
  CREATE_COMMENT = 10,
  /** 评论被点赞 */
  COMMENT_LIKED = 11,
  /** 每日首评 */
  FIRST_COMMENT_OF_DAY = 12,

  // 漫画作品相关
  /** 漫画浏览 */
  COMIC_WORK_VIEW = 100,
  /** 漫画点赞 */
  COMIC_WORK_LIKE = 101,
  /** 漫画收藏 */
  COMIC_WORK_FAVORITE = 102,

  // 小说作品相关
  /** 小说浏览 */
  NOVEL_WORK_VIEW = 200,
  /** 小说点赞 */
  NOVEL_WORK_LIKE = 201,
  /** 小说收藏 */
  NOVEL_WORK_FAVORITE = 202,

  // 漫画章节相关
  /** 章节阅读 */
  COMIC_CHAPTER_READ = 300,
  /** 章节点赞 */
  COMIC_CHAPTER_LIKE = 301,
  /** 章节购买 */
  COMIC_CHAPTER_PURCHASE = 302,
  /** 章节下载 */
  COMIC_CHAPTER_DOWNLOAD = 303,
  /** 章节兑换 (仅积分) */
  COMIC_CHAPTER_EXCHANGE = 304,
}

/**
 * 成长规则类型名称映射
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
  [GrowthRuleTypeEnum.FIRST_COMMENT_OF_DAY]: '每日首评',
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

/**
 * 获取成长规则类型名称
 */
export function getGrowthRuleTypeName(type: GrowthRuleTypeEnum): string {
  return GrowthRuleTypeNames[type] ?? '未知规则'
}
