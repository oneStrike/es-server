/**
 * PostgreSQL 错误码常量
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** PostgreSQL 约束类错误码 */
export const PostgresErrorCode = {
  /** 唯一约束冲突 */
  UNIQUE_VIOLATION: '23505',
  /** 外键约束冲突 */
  FOREIGN_KEY_VIOLATION: '23503',
  /** 非空约束冲突 */
  NOT_NULL_VIOLATION: '23502',
  /** 检查约束冲突 */
  CHECK_VIOLATION: '23514',
  /** 事务序列化失败 */
  SERIALIZATION_FAILURE: '40001',
} as const

/** 默认错误消息 */
export const PostgresDefaultMessages: Record<string, string> = {
  [PostgresErrorCode.UNIQUE_VIOLATION]: '数据已存在',
  [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: '关联数据不存在',
  [PostgresErrorCode.NOT_NULL_VIOLATION]: '必填字段不能为空',
  [PostgresErrorCode.CHECK_VIOLATION]: '数据不符合要求',
  [PostgresErrorCode.SERIALIZATION_FAILURE]: '操作冲突，请重试',
}

/** 默认 HTTP 状态码 */
export const PostgresHttpStatus: Record<string, number> = {
  [PostgresErrorCode.UNIQUE_VIOLATION]: 409,
  [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: 400,
  [PostgresErrorCode.NOT_NULL_VIOLATION]: 400,
  [PostgresErrorCode.CHECK_VIOLATION]: 400,
  [PostgresErrorCode.SERIALIZATION_FAILURE]: 409,
}

/** PostgreSQL 错误信息接口 */
export interface PostgresError {
  code: string
  constraint?: string
  table?: string
  column?: string
  detail?: string
  message: string
}

/**
 * 从错误对象中提取 PostgreSQL 错误信息
 * 支持两种情况:
 * 1. code 直接在 error 上
 * 2. code 在 error.cause 上 (Drizzle ORM 包装的错误)
 */
export function getPostgresError(error: unknown): PostgresError | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const err = error as Record<string, unknown>

  // 情况1: code 直接在 error 上
  if ('code' in err && typeof err.code === 'string') {
    return {
      code: err.code,
      constraint: err.constraint as string | undefined,
      table: err.table as string | undefined,
      column: err.column as string | undefined,
      detail: err.detail as string | undefined,
      message: err.message as string,
    }
  }

  // 情况2: code 在 error.cause 上
  if ('cause' in err && typeof err.cause === 'object' && err.cause !== null) {
    const cause = err.cause as Record<string, unknown>
    if ('code' in cause && typeof cause.code === 'string') {
      return {
        code: cause.code,
        constraint: cause.constraint as string | undefined,
        table: cause.table as string | undefined,
        column: cause.column as string | undefined,
        detail: cause.detail as string | undefined,
        message: (cause.message as string) || (err.message as string),
      }
    }
  }

  return null
}

/** 检查是否为 PostgreSQL 错误 */
export function isPostgresError(error: unknown): error is PostgresError {
  return getPostgresError(error) !== null
}

/** 唯一约束错误详情解析正则 */
const UNIQUE_VIOLATION_PATTERN =
  /键值["\u201C]?\(([^)]+)\)=\(([^)]+)\).*存在|Key\s+["\u201C]?\(([^)]+)\)=\(([^)]+)\).*exists/i

/**
 * 解析 PostgreSQL 唯一约束错误的 detail 字段
 * 提取冲突的键值对
 * @param detail PostgreSQL 错误的 detail 字段，例如: '键值"(word)=(测试)" 已经存在'
 * @returns 解析后的键值对对象，例如: { word: '测试' }
 */
export function parseUniqueViolationDetail(
  detail?: string,
): Record<string, string> | null {
  if (!detail) {
    return null
  }

  const match = detail.match(UNIQUE_VIOLATION_PATTERN)

  if (!match) {
    return null
  }

  // 中文匹配结果在 1,2，英文在 3,4
  const columns = (match[1] || match[3] || '').split(',').map((s) => s.trim())
  const values = (match[2] || match[4] || '').split(',').map((s) => s.trim())

  if (columns.length !== values.length || columns.length === 0) {
    return null
  }

  const result: Record<string, string> = {}
  columns.forEach((col, i) => {
    result[col] = values[i]
  })

  return result
}

/**
 * 生成用户友好的唯一约束冲突消息
 * @param pgError PostgreSQL 错误信息
 * @param defaultMessage 默认消息
 * @returns 格式化的错误消息
 */
export function formatUniqueViolationMessage(
  pgError: PostgresError,
  defaultMessage = '数据已存在',
): string {
  const keyValues = parseUniqueViolationDetail(pgError.detail)

  if (!keyValues) {
    return defaultMessage
  }

  const entries = Object.entries(keyValues)
  if (entries.length === 0) {
    return defaultMessage
  }

  // 单个字段: "【测试】已经存在"
  if (entries.length === 1) {
    const [, value] = entries[0]
    return `【${value}】已经存在`
  }

  // 多个字段: "【字段1=值1, 字段2=值2】已经存在"
  const parts = entries.map(([col, val]) => `${col}=${val}`).join(', ')
  return `【${parts}】已经存在`
}
