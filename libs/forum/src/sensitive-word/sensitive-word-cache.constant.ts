/**
 * 敏感词缓存键名常量
 * 用于 Redis 缓存的键名定义，支持按不同维度组织敏感词数据
 */
export const SENSITIVE_WORD_CACHE_KEYS = {
  /**
   * 所有敏感词的缓存键
   * 用于存储完整的敏感词列表
   */
  ALL_WORDS: 'sensitive-word:all',

  /**
   * 按敏感等级分组的缓存键生成器
   * @param level - 敏感等级（1-低，2-中，3-高）
   * @returns 缓存键名
   */
  WORDS_BY_LEVEL: (level: number) => `sensitive-word:level:${level}`,

  /**
   * 按敏感词类型分组的缓存键生成器
   * @param type - 敏感词类型（如：政治、色情、暴力等）
   * @returns 缓存键名
   */
  WORDS_BY_TYPE: (type: number) => `sensitive-word:type:${type}`,

  /**
   * 按匹配模式分组的缓存键生成器
   * @param matchMode - 匹配模式（1-精确匹配，2-模糊匹配）
   * @returns 缓存键名
   */
  WORDS_BY_MATCH_MODE: (matchMode: number) => `sensitive-word:match-mode:${matchMode}`,
}

/**
 * 敏感词缓存过期时间常量（单位：秒）
 * 定义不同场景下的缓存有效期
 */
export const SENSITIVE_WORD_CACHE_TTL = {
  /**
   * 默认缓存过期时间（1小时）
   * 适用于常规敏感词数据缓存
   */
  DEFAULT: 3600,

  /**
   * 短期缓存过期时间（10分钟）
   * 适用于频繁更新的敏感词数据
   */
  SHORT: 600,

  /**
   * 长期缓存过期时间（2小时）
   * 适用于相对稳定的敏感词数据
   */
  LONG: 7200,
}
