import type { sensitiveWord } from '@db/schema'
import type {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
  StatisticsTypeEnum,
} from './sensitive-word-constant'

/** 敏感词实体类型（从数据库查询的结果） */
export type SensitiveWord = typeof sensitiveWord.$inferSelect

/**
 * 命中敏感词结果
 */
export interface MatchedWord {
  /** 命中的词 */
  word: string
  /** 起始位置 */
  start: number
  /** 结束位置 */
  end: number
  /** 敏感等级 */
  level: SensitiveWordLevelEnum
  /** 敏感类型 */
  type: SensitiveWordTypeEnum
  /** 替换后的词 */
  replaceWord?: string | null
}

/**
 * 敏感词检测选项
 */
export interface DetectOptions {
  /** 是否替换 */
  replace?: boolean
  /** 替换字符 */
  replaceChar?: string
  /** 匹配模式 */
  matchMode?: MatchModeEnum
}

/**
 * 敏感词分页查询条件。
 * 用于管理端分页与筛选。
 */
export interface QuerySensitiveWordPageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  word?: string
  isEnabled?: boolean
  level?: SensitiveWordLevelEnum
  type?: SensitiveWordTypeEnum
  matchMode?: MatchModeEnum
}

/**
 * 敏感词创建入参。
 * 仅包含业务可写字段。
 */
export interface CreateSensitiveWordInput {
  word: string
  replaceWord?: string
  isEnabled: boolean
  level: SensitiveWordLevelEnum
  type: SensitiveWordTypeEnum
  matchMode: MatchModeEnum
  remark?: string
}

/**
 * 敏感词更新入参。
 * 包含记录 id 与业务可写字段。
 */
export interface UpdateSensitiveWordInput extends CreateSensitiveWordInput {
  id: number
}

/**
 * 敏感词状态更新入参。
 * 仅切换启用状态。
 */
export interface UpdateSensitiveWordStatusInput {
  id: number
  isEnabled: boolean
}

/**
 * 敏感词检测入参。
 * 包含待检测文本与可选匹配模式。
 */
export interface SensitiveWordDetectInput {
  content: string
  matchMode?: MatchModeEnum
}

/**
 * 敏感词替换入参。
 * 在检测参数基础上增加替换字符。
 */
export interface SensitiveWordReplaceInput extends SensitiveWordDetectInput {
  replaceChar?: string
}

/**
 * 敏感词检测结果。
 * 返回匹配命中列表与最高等级。
 */
export interface SensitiveWordDetectResult {
  hits: MatchedWord[]
  highestLevel?: SensitiveWordLevelEnum
}

/**
 * 敏感词统计查询条件。
 * type 表示统计维度。
 */
export interface SensitiveWordStatisticsQueryInput {
  type?: StatisticsTypeEnum
}

/**
 * 按级别统计结果项。
 */
export interface SensitiveWordLevelStatistics {
  level: SensitiveWordLevelEnum
  levelName: string
  count: number
  hitCount: number
}

/**
 * 按类型统计结果项。
 */
export interface SensitiveWordTypeStatistics {
  type: SensitiveWordTypeEnum
  typeName: string
  count: number
  hitCount: number
}

/**
 * 热门命中词统计项。
 */
export interface SensitiveWordTopHitStatistics {
  word: string
  hitCount: number
  level: SensitiveWordLevelEnum
  type: SensitiveWordTypeEnum
  lastHitAt?: Date
}

/**
 * 最近命中词统计项。
 */
export interface SensitiveWordRecentHitStatistics extends SensitiveWordTopHitStatistics {}

/**
 * 单维度统计返回。
 */
export interface SensitiveWordStatisticsResponse {
  type: StatisticsTypeEnum
  data: Array<
    | SensitiveWordLevelStatistics
    | SensitiveWordTypeStatistics
    | SensitiveWordTopHitStatistics
    | SensitiveWordRecentHitStatistics
  >
}

/**
 * 完整统计数据聚合。
 * 用于管理端完整统计接口。
 */
export interface SensitiveWordStatisticsData {
  totalWords: number
  enabledWords: number
  disabledWords: number
  totalHits: number
  todayHits: number
  lastWeekHits: number
  lastMonthHits: number
  levelStatistics: SensitiveWordLevelStatistics[]
  typeStatistics: SensitiveWordTypeStatistics[]
  topHitWords: SensitiveWordTopHitStatistics[]
  recentHitWords: SensitiveWordRecentHitStatistics[]
}

/**
 * 缓存查询配置
 *
 * @template T 缓存数据类型
 */
export interface CacheQueryConfig<T> {
  /** 缓存键 */
  cacheKey: string
  /** 日志输出内容生成器 */
  logMessage: (data: T[]) => string
  /** 数据加载函数 */
  queryFn: () => Promise<T[]>
}

/**
 * 模糊匹配命中结果
 */
export interface FuzzyMatchResult {
  /** 命中的词 */
  word: string
  /** 起始位置 */
  start: number
  /** 结束位置 */
  end: number
  /** 编辑距离 */
  distance: number
}

/**
 * 精确匹配命中结果
 */
export interface MatchResult {
  /** 命中的词 */
  word: string
  /** 起始位置 */
  start: number
  /** 结束位置 */
  end: number
}

/**
 * AC 自动机 Trie 节点结构
 */
export interface TrieNode {
  /** 子节点 */
  children: Map<string, TrieNode>
  /** 失败指针 */
  fail: TrieNode | null
  /** 是否命中词尾 */
  output: boolean
  /** 命中词 */
  word: string | null
  /** 深度 */
  depth: number
}
