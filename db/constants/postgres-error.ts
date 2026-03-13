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

/** 检查是否为 PostgreSQL 错误 */
export function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PostgresError).code === 'string'
  )
}
