import type { SQL, SQLWrapper } from '../drizzle.type'
import { ilike } from 'drizzle-orm'

const BACKSLASH_REGEX = /\\/g
const PERCENT_REGEX = /%/g
const UNDERSCORE_REGEX = /_/g

export function escapeLikePattern(input: string): string {
  return input
    .replace(BACKSLASH_REGEX, '\\\\')
    .replace(PERCENT_REGEX, '\\%')
    .replace(UNDERSCORE_REGEX, '\\_')
}

export interface LikePatternOptions {
  mode?: 'contains' | 'prefix' | 'suffix' | 'exact'
  trim?: boolean
}

/**
 * 统一构建 LIKE/ILIKE 使用的参数模式，收口空值、trim 与通配符拼接规则。
 */
export function buildLikePattern(
  input?: string | null,
  options: LikePatternOptions = {},
) {
  const value = options.trim === false ? input : input?.trim()
  if (!value) {
    return undefined
  }

  const escaped = escapeLikePattern(value)
  switch (options.mode ?? 'contains') {
    case 'exact':
      return escaped
    case 'prefix':
      return `${escaped}%`
    case 'suffix':
      return `%${escaped}`
    case 'contains':
      return `%${escaped}%`
  }
}

/**
 * 构建可直接塞入条件数组的 ILIKE 表达式，避免业务层重复拼接 pattern。
 */
export function buildILikeCondition(
  column: SQLWrapper,
  input?: string | null,
  options?: LikePatternOptions,
): SQL | undefined {
  const pattern = buildLikePattern(input, options)
  return pattern ? ilike(column, pattern) : undefined
}
