import type {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from './sensitive-word-constant'

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
