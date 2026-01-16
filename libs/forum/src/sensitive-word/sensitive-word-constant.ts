/**
 * 敏感词级别
 */
export enum ForumSensitiveWordLevelEnum {
  /** 严重 */
  SEVERE = 1,
  /** 一般 */
  GENERAL = 2,
  /** 轻微 */
  LIGHT = 3,
}

/**
 * 敏感词级别名称映射
 */
export const ForumSensitiveWordLevelNames: Record<
  ForumSensitiveWordLevelEnum,
  string
> = {
  [ForumSensitiveWordLevelEnum.SEVERE]: '严重',
  [ForumSensitiveWordLevelEnum.GENERAL]: '一般',
  [ForumSensitiveWordLevelEnum.LIGHT]: '轻微',
}

/**
 * 敏感词类型
 */
export enum ForumSensitiveWordTypeEnum {
  /** 政治 */
  POLITICS = 1,
  /** 色情 */
  PORN = 2,
  /** 暴力 */
  VIOLENCE = 3,
  /** 广告 */
  AD = 4,
  /** 其他 */
  OTHER = 5,
}

/**
 * 敏感词类型名称映射
 */
export const ForumSensitiveWordTypeNames: Record<
  ForumSensitiveWordTypeEnum,
  string
> = {
  [ForumSensitiveWordTypeEnum.POLITICS]: '政治',
  [ForumSensitiveWordTypeEnum.PORN]: '色情',
  [ForumSensitiveWordTypeEnum.VIOLENCE]: '暴力',
  [ForumSensitiveWordTypeEnum.AD]: '广告',
  [ForumSensitiveWordTypeEnum.OTHER]: '其他',
}

/**
 * 匹配模式
 */
export enum ForumMatchModeEnum {
  /** 精确匹配 */
  EXACT = 1,
  /** 模糊匹配 */
  FUZZY = 2,
  /** 正则匹配 */
  REGEX = 3,
}

/**
 * 统计类型
 */
export enum ForumStatisticsTypeEnum {
  /** 按级别统计 */
  LEVEL = 'level',
  /** 按类型统计 */
  TYPE = 'type',
  /** 热门敏感词统计 */
  TOP_HITS = 'topHits',
  /** 最近命中统计 */
  RECENT_HITS = 'recentHits',
}

/**
 * 统计类型名称映射
 */
export const ForumStatisticsTypeNames: Record<ForumStatisticsTypeEnum, string> =
  {
    [ForumStatisticsTypeEnum.LEVEL]: '按级别统计',
    [ForumStatisticsTypeEnum.TYPE]: '按类型统计',
    [ForumStatisticsTypeEnum.TOP_HITS]: '热门敏感词统计',
    [ForumStatisticsTypeEnum.RECENT_HITS]: '最近命中统计',
  }
