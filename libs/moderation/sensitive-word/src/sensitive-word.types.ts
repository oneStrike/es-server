import type { sensitiveWord } from '@db/schema'
import type {
  MatchModeEnum,
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitOperationTypeEnum,
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
}

/**
 * 敏感词检测结果。
 * 返回匹配命中列表与最高等级。
 */
/** 稳定领域类型 `SensitiveWordDetectResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface SensitiveWordDetectResult {
  hits: MatchedWord[]
  highestLevel?: SensitiveWordLevelEnum
}

/**
 * 内部富命中结果。
 * 在公开命中结构基础上补齐词条 ID 与词条匹配模式，供统计与替换裁剪使用。
 */
/** 稳定领域类型 `SensitiveWordDetectedHit`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface SensitiveWordDetectedHit extends MatchedWord {
  sensitiveWordId: number
  matchMode: MatchModeEnum
}

/**
 * 内部检测结果。
 * 同时返回富命中结构与对外命中结构，避免调用方重复做 strip。
 */
/** 稳定领域类型 `SensitiveWordInternalDetectResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface SensitiveWordInternalDetectResult {
  hits: SensitiveWordDetectedHit[]
  publicHits: MatchedWord[]
  highestLevel?: SensitiveWordLevelEnum
}

/**
 * 命中实体类型键。
 * 仅用于业务服务入参，可读性优先。
 */
/** 稳定领域类型 `SensitiveWordHitEntityTypeKey`。仅供内部领域/服务链路复用，避免重复定义。 */
export type SensitiveWordHitEntityTypeKey = 'topic' | 'comment'

/**
 * 命中操作类型键。
 * 仅用于业务服务入参，可读性优先。
 */
/** 稳定领域类型 `SensitiveWordHitOperationTypeKey`。仅供内部领域/服务链路复用，避免重复定义。 */
export type SensitiveWordHitOperationTypeKey = 'create' | 'update'

/**
 * 业务实体命中记录入参。
 * 用于在持久化链路中写命中明细并同步词表快照。
 */
/** 稳定领域类型 `RecordSensitiveWordEntityHitsInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface RecordSensitiveWordEntityHitsInput {
  entityType: SensitiveWordHitEntityTypeKey
  entityId: number
  operationType: SensitiveWordHitOperationTypeKey
  hits: SensitiveWordDetectedHit[]
  occurredAt?: Date
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
/** 稳定领域类型 `SensitiveWordStatisticsData`。仅供内部领域/服务链路复用，避免重复定义。 */
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
 * 命中实体类型映射。
 * 字符串键只在业务层使用，落库前统一映射到 smallint。
 */
export const SensitiveWordHitEntityTypeMap: Record<
  SensitiveWordHitEntityTypeKey,
  SensitiveWordHitEntityTypeEnum
> = {
  topic: 1,
  comment: 2,
}

/**
 * 命中操作类型映射。
 * 字符串键只在业务层使用，落库前统一映射到 smallint。
 */
export const SensitiveWordHitOperationTypeMap: Record<
  SensitiveWordHitOperationTypeKey,
  SensitiveWordHitOperationTypeEnum
> = {
  create: 1,
  update: 2,
}

/**
 * 缓存查询配置
 *
 * @template T 缓存数据类型
 */
/** 稳定领域类型 `CacheQueryConfig`。仅供内部领域/服务链路复用，避免重复定义。 */
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
