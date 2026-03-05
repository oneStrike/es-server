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

  // 漫画作品相关
  /** 漫画浏览 */
  COMIC_WORK_VIEW = 101,
  /** 漫画点赞 */
  COMIC_WORK_LIKE = 102,
  /** 漫画收藏 */
  COMIC_WORK_FAVORITE = 103,

  // 漫画章节相关
  /** 章节阅读 */
  COMIC_CHAPTER_READ = 111,
  /** 章节点赞 */
  COMIC_CHAPTER_LIKE = 112,
  /** 章节购买 */
  COMIC_CHAPTER_PURCHASE = 113,
  /** 章节下载 */
  COMIC_CHAPTER_DOWNLOAD = 114,
  /** 章节兑换 (仅积分) */
  COMIC_CHAPTER_EXCHANGE = 115,
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
  [GrowthRuleTypeEnum.COMIC_WORK_VIEW]: '漫画浏览',
  [GrowthRuleTypeEnum.COMIC_WORK_LIKE]: '漫画点赞',
  [GrowthRuleTypeEnum.COMIC_WORK_FAVORITE]: '漫画收藏',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_READ]: '章节阅读',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE]: '章节点赞',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_PURCHASE]: '章节购买',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_DOWNLOAD]: '章节下载',
  [GrowthRuleTypeEnum.COMIC_CHAPTER_EXCHANGE]: '章节兑换',
}

/**
 * 获取成长规则类型名称
 */
export function getGrowthRuleTypeName(type: GrowthRuleTypeEnum): string {
  return GrowthRuleTypeNames[type] ?? '未知规则'
}
