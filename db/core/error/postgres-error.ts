/**
 * PostgreSQL 错误码常量
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** PostgreSQL 约束类错误码 */
export const PostgresErrorCode = {
  /** 唯一约束冲突 */
  UNIQUE_VIOLATION: '23505',
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
  [PostgresErrorCode.NOT_NULL_VIOLATION]: '必填字段不能为空',
  [PostgresErrorCode.CHECK_VIOLATION]: '数据不符合要求',
  [PostgresErrorCode.SERIALIZATION_FAILURE]: '操作冲突，请重试',
}

/** 默认 HTTP 状态码 */
export const PostgresHttpStatus: Record<string, number> = {
  [PostgresErrorCode.UNIQUE_VIOLATION]: 409,
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

export interface PostgresErrorDescriptor {
  message: string
  status: number
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

export function isPostgresError(error: unknown): error is PostgresError {
  return getPostgresError(error) !== null
}

export function getPostgresErrorDescriptor(
  code: string,
): PostgresErrorDescriptor | null {
  const message = PostgresDefaultMessages[code]
  const status = PostgresHttpStatus[code]

  if (!message || !status) {
    return null
  }

  return {
    message,
    status,
  }
}
