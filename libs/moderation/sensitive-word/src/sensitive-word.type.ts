import type {
  MatchModeEnum,
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitOperationTypeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from './sensitive-word-constant'

/**
 * 敏感词检测支持的内容字段键。
 */
export type SensitiveWordHitFieldKey = 'title' | 'content'

/**
 * 多字段敏感词检测时的待检测内容片段。
 */
export interface SensitiveWordHitSegment {
  field: SensitiveWordHitFieldKey
  content: string
}

/**
 * 敏感词命中的基础结构，供 DTO 和内部类型共同复用。
 */
export interface SensitiveWordHitBase {
  word: string
  start: number
  end: number
  level: SensitiveWordLevelEnum
  type: SensitiveWordTypeEnum
  field?: string
  replaceWord?: string | null
}

/**
 * 内部检测链路使用的富命中结果。
 */
export interface SensitiveWordDetectedHit extends SensitiveWordHitBase {
  sensitiveWordId: number
  matchMode: MatchModeEnum
  field?: SensitiveWordHitFieldKey
}

/**
 * 可记录敏感词命中的业务实体类型键。
 */
export type SensitiveWordHitEntityTypeKey = 'topic' | 'comment'

/**
 * 可记录敏感词命中的业务操作类型键。
 */
export type SensitiveWordHitOperationTypeKey = 'create' | 'update'

/**
 * 持久化业务实体敏感词命中的入参。
 */
export interface RecordSensitiveWordEntityHitsInput {
  entityType: SensitiveWordHitEntityTypeKey
  entityId: number
  operationType: SensitiveWordHitOperationTypeKey
  hits: SensitiveWordDetectedHit[]
  occurredAt?: Date
}

/**
 * 业务实体类型键到数据库枚举值的映射。
 */
export const SensitiveWordHitEntityTypeMap: Record<
  SensitiveWordHitEntityTypeKey,
  SensitiveWordHitEntityTypeEnum
> = {
  /** 论坛主题。 */
  topic: 1,
  /** 用户评论。 */
  comment: 2,
}

/**
 * 业务操作类型键到数据库枚举值的映射。
 */
export const SensitiveWordHitOperationTypeMap: Record<
  SensitiveWordHitOperationTypeKey,
  SensitiveWordHitOperationTypeEnum
> = {
  /** 创建内容。 */
  create: 1,
  /** 更新内容。 */
  update: 2,
}

/**
 * 敏感词缓存查询的配置。
 */
export interface CacheQueryConfig<T> {
  cacheKey: string
  queryFn: () => Promise<T[]>
}

/**
 * 模糊匹配算法输出的命中结果。
 */
export interface FuzzyMatchResult {
  word: string
  start: number
  end: number
  distance: number
}

/**
 * 精确匹配算法输出的命中结果。
 */
export interface MatchResult {
  word: string
  start: number
  end: number
}

/**
 * AC 自动机使用的 Trie 节点结构。
 */
export interface TrieNode {
  children: Map<string, TrieNode>
  fail: TrieNode | null
  output: boolean
  word: string | null
  depth: number
}
