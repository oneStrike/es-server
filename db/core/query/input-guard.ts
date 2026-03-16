import type { DrizzleWhereFieldFilter } from '../drizzle.type'

const BACKSLASH_REGEX = /\\/g
const PERCENT_REGEX = /%/g
const UNDERSCORE_REGEX = /_/g

const WHERE_FILTER_KEYS = new Set<keyof DrizzleWhereFieldFilter>([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'startsWith',
  'endsWith',
  'in',
  'notIn',
  'between',
  'isNull',
  'isNotNull',
])

export function isWhereFieldFilter(
  value: unknown,
): value is DrizzleWhereFieldFilter {
  if (!value || typeof value !== 'object') {
    return false
  }
  if (Array.isArray(value) || value instanceof Date) {
    return false
  }

  const keys = Object.keys(value as Record<string, unknown>)
  return keys.some((key) =>
    WHERE_FILTER_KEYS.has(key as keyof DrizzleWhereFieldFilter),
  )
}

export function escapeLikePattern(input: string): string {
  return input
    .replace(BACKSLASH_REGEX, '\\\\')
    .replace(PERCENT_REGEX, '\\%')
    .replace(UNDERSCORE_REGEX, '\\_')
}
