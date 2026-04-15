/**
 * 敏感词级别
 */
export enum SensitiveWordLevelEnum {
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
export const SensitiveWordLevelNames: Record<SensitiveWordLevelEnum, string> = {
  [SensitiveWordLevelEnum.SEVERE]: '严重',
  [SensitiveWordLevelEnum.GENERAL]: '一般',
  [SensitiveWordLevelEnum.LIGHT]: '轻微',
}

/**
 * 敏感词类型
 */
export enum SensitiveWordTypeEnum {
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
export const SensitiveWordTypeNames: Record<SensitiveWordTypeEnum, string> = {
  [SensitiveWordTypeEnum.POLITICS]: '政治',
  [SensitiveWordTypeEnum.PORN]: '色情',
  [SensitiveWordTypeEnum.VIOLENCE]: '暴力',
  [SensitiveWordTypeEnum.AD]: '广告',
  [SensitiveWordTypeEnum.OTHER]: '其他',
}

/**
 * 匹配模式
 */
export enum MatchModeEnum {
  /** 精确匹配 */
  EXACT = 1,
  /** 模糊匹配 */
  FUZZY = 2,
}

/**
 * 敏感词命中实体类型
 */
export enum SensitiveWordHitEntityTypeEnum {
  /** 主题 */
  TOPIC = 1,
  /** 评论 */
  COMMENT = 2,
}

/**
 * 敏感词命中操作类型
 */
export enum SensitiveWordHitOperationTypeEnum {
  /** 创建 */
  CREATE = 1,
  /** 更新 */
  UPDATE = 2,
}

/**
 * 统计类型
 */
export enum StatisticsTypeEnum {
  /** 按级别统计 */
  LEVEL = 'level',
  /** 按类型统计 */
  TYPE = 'type',
  /** 热门敏感词统计 */
  TOP_HITS = 'topHits',
  /** 最近命中统计 */
  RECENT_HITS = 'recentHits',
}
