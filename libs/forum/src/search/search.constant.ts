/**
 * 搜索类型枚举
 */
export enum SearchTypeEnum {
  /** 主题 */
  TOPIC = 'topic',
  /** 回复 */
  REPLY = 'reply',
  /** 全部 */
  ALL = 'all',
}

/**
 * 排序类型枚举
 */
export enum SearchSortTypeEnum {
  /** 最新 */
  LATEST = 'latest',
  /** 最热 */
  HOT = 'hot',
  /** 相关度 */
  RELEVANCE = 'relevance',
}

/**
 * 时间筛选枚举
 */
export enum SearchTimeFilterEnum {
  /** 全部时间 */
  ALL = 'all',
  /** 最近一天 */
  ONE_DAY = 'one_day',
  /** 最近一周 */
  ONE_WEEK = 'one_week',
  /** 最近一月 */
  ONE_MONTH = 'one_month',
  /** 最近一年 */
  ONE_YEAR = 'one_year',
}
