/**
 * 论坛配置缓存键名常量
 * 用于 Redis 缓存的键名定义
 */
export const FORUM_CONFIG_CACHE_KEYS = {
  /**
   * 论坛配置的缓存键
   * 用于存储完整的论坛配置
   */
  CONFIG: 'forum-config',
}

/**
 * 论坛配置缓存过期时间常量（单位：秒）
 * 定义不同场景下的缓存有效期
 */
export const FORUM_CONFIG_CACHE_TTL = {
  /**
   * 默认缓存过期时间（1小时）
   * 适用于常规配置数据缓存
   */
  DEFAULT: 3600,

  /**
   * 短期缓存过期时间（10分钟）
   * 适用于频繁更新的配置数据
   */
  SHORT: 600,

  /**
   * 长期缓存过期时间（2小时）
   * 适用于相对稳定的配置数据
   */
  LONG: 7200,

  /**
   * 空值缓存过期时间（5分钟）
   * 用于防止缓存穿透
   */
  NULL_VALUE: 300,
}

/**
 * 论坛配置缓存监控指标
 */
export const FORUM_CONFIG_CACHE_METRICS = {
  /**
   * 缓存命中率
   */
  HIT_RATE: 'forum-config:cache:hit-rate',

  /**
   * 缓存命中次数
   */
  HIT_COUNT: 'forum-config:cache:hit-count',

  /**
   * 缓存未命中次数
   */
  MISS_COUNT: 'forum-config:cache:miss-count',

  /**
   * 缓存穿透次数
   */
  PENETRATION_COUNT: 'forum-config:cache:penetration-count',
}
