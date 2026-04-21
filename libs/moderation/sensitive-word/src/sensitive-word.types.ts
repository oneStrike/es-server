import type {
  MatchModeEnum,
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitOperationTypeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from './sensitive-word-constant'

// 命中字段键。
export type SensitiveWordHitFieldKey = 'title' | 'content'

// 多字段场景分段检测
export interface SensitiveWordHitSegment {
  field: SensitiveWordHitFieldKey
  content: string
}

// 敏感词命中基础结构，供 DTO 和内部类型共同使用。
export interface SensitiveWordHitBase {
  word: string
  start: number
  end: number
  level: SensitiveWordLevelEnum
  type: SensitiveWordTypeEnum
  field?: string
  replaceWord?: string | null
}

// 内部富命中结果。
export interface SensitiveWordDetectedHit extends SensitiveWordHitBase {
  sensitiveWordId: number
  matchMode: MatchModeEnum
  field?: SensitiveWordHitFieldKey
}

// 命中实体类型键。
export type SensitiveWordHitEntityTypeKey = 'topic' | 'comment'

// 命中操作类型键。
export type SensitiveWordHitOperationTypeKey = 'create' | 'update'

// 业务实体命中记录入参。
export interface RecordSensitiveWordEntityHitsInput {
  entityType: SensitiveWordHitEntityTypeKey
  entityId: number
  operationType: SensitiveWordHitOperationTypeKey
  hits: SensitiveWordDetectedHit[]
  occurredAt?: Date
}

// 命中实体类型映射。
export const SensitiveWordHitEntityTypeMap: Record<
  SensitiveWordHitEntityTypeKey,
  SensitiveWordHitEntityTypeEnum
> = {
  topic: 1,
  comment: 2,
}

// 命中操作类型映射。
export const SensitiveWordHitOperationTypeMap: Record<
  SensitiveWordHitOperationTypeKey,
  SensitiveWordHitOperationTypeEnum
> = {
  create: 1,
  update: 2,
}

// 缓存查询配置。
export interface CacheQueryConfig<T> {
  cacheKey: string
  queryFn: () => Promise<T[]>
}

// 模糊匹配命中结果。
export interface FuzzyMatchResult {
  word: string
  start: number
  end: number
  distance: number
}

// 精确匹配命中结果。
export interface MatchResult {
  word: string
  start: number
  end: number
}

// AC 自动机 Trie 节点结构。
export interface TrieNode {
  children: Map<string, TrieNode>
  fail: TrieNode | null
  output: boolean
  word: string | null
  depth: number
}
