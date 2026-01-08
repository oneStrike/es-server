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
