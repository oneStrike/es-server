/**
 * 搜索类型枚举
 */
export enum ForumSearchTypeEnum {
  /** 主题 */
  TOPIC = 'topic',
  /** 评论 */
  COMMENT = 'comment',
  /** 全部 */
  ALL = 'all',
}

/**
 * 排序类型枚举
 */
export enum ForumSearchSortTypeEnum {
  /** 最新 */
  LATEST = 'latest',
  /** 最热 */
  HOT = 'hot',
  /** 相关度 */
  RELEVANCE = 'relevance',
}
