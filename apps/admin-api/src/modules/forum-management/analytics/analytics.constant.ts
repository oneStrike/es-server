/**
 * 数据分析时间范围枚举
 */
export enum TimeRangeEnum {
  /** 今天 */
  TODAY = 'today',
  /** 昨天 */
  YESTERDAY = 'yesterday',
  /** 最近7天 */
  LAST_7_DAYS = 'last_7_days',
  /** 最近30天 */
  LAST_30_DAYS = 'last_30_days',
  /** 最近90天 */
  LAST_90_DAYS = 'last_90_days',
  /** 本月 */
  THIS_MONTH = 'this_month',
  /** 上月 */
  LAST_MONTH = 'last_month',
  /** 今年 */
  THIS_YEAR = 'this_year',
}

/**
 * 数据分析时间范围名称映射
 */
export const TimeRangeNameMap: Record<TimeRangeEnum, string> = {
  [TimeRangeEnum.TODAY]: '今天',
  [TimeRangeEnum.YESTERDAY]: '昨天',
  [TimeRangeEnum.LAST_7_DAYS]: '最近7天',
  [TimeRangeEnum.LAST_30_DAYS]: '最近30天',
  [TimeRangeEnum.LAST_90_DAYS]: '最近90天',
  [TimeRangeEnum.THIS_MONTH]: '本月',
  [TimeRangeEnum.LAST_MONTH]: '上月',
  [TimeRangeEnum.THIS_YEAR]: '今年',
}

/**
 * 数据分析类型枚举
 */
export enum AnalyticsTypeEnum {
  /** 论坛概览 */
  OVERVIEW = 'overview',
  /** 活跃度趋势 */
  ACTIVITY_TREND = 'activity_trend',
  /** 热门主题排行 */
  HOT_TOPICS = 'hot_topics',
  /** 活跃用户排行 */
  ACTIVE_USERS = 'active_users',
  /** 板块统计 */
  SECTION_STATS = 'section_stats',
}

/**
 * 数据分析类型名称映射
 */
export const AnalyticsTypeNameMap: Record<AnalyticsTypeEnum, string> = {
  [AnalyticsTypeEnum.OVERVIEW]: '论坛概览',
  [AnalyticsTypeEnum.ACTIVITY_TREND]: '活跃度趋势',
  [AnalyticsTypeEnum.HOT_TOPICS]: '热门主题排行',
  [AnalyticsTypeEnum.ACTIVE_USERS]: '活跃用户排行',
  [AnalyticsTypeEnum.SECTION_STATS]: '板块统计',
}
