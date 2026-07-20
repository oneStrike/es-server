import type { ApiErrorCode } from '@libs/platform/constant'
import { BusinessErrorCode, PlatformErrorCode } from '@libs/platform/constant'
import { HttpStatus } from '@nestjs/common'
import { DrizzleQueryError } from 'drizzle-orm'

/**
 * PostgreSQL 错误码常量。
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PostgresErrorCode = {
  /** 唯一约束冲突 */
  UNIQUE_VIOLATION: '23505',
  /** 非空约束冲突 */
  NOT_NULL_VIOLATION: '23502',
  /** 外键约束冲突 */
  FOREIGN_KEY_VIOLATION: '23503',
  /** 检查约束冲突 */
  CHECK_VIOLATION: '23514',
  /** 排除约束冲突 */
  EXCLUSION_VIOLATION: '23P01',
  /** 事务序列化失败 */
  SERIALIZATION_FAILURE: '40001',
  /** 事务死锁 */
  DEADLOCK_DETECTED: '40P01',
} as const

export type PostgresErrorCodeValue =
  (typeof PostgresErrorCode)[keyof typeof PostgresErrorCode]

export type PostgresErrorSource =
  'drizzle-query' | 'postgres-driver' | 'postgres-pool'

export type PostgresErrorCategory =
  'integrity' | 'transaction' | 'connection' | 'programming' | 'unknown'

export type PostgresExceptionKind = 'business' | 'http'

export type PostgresErrorMessageKey =
  | 'duplicate'
  | 'notNull'
  | 'foreignKey'
  | 'check'
  | 'conflict'
  | 'serviceUnavailable'

/** 安全的 PostgreSQL 错误事实；不得包含 query、params、message、detail 或 raw stack。 */
export interface PostgresErrorFacts {
  source: PostgresErrorSource
  sqlState: string
  sqlStateClass: string
  category: PostgresErrorCategory
  retryable: boolean
  schema?: string
  constraint?: string
  table?: string
  column?: string
}

export interface PostgresErrorClassifierOptions {
  source?: Extract<PostgresErrorSource, 'postgres-pool'>
}

export interface PostgresErrorResponseDescriptor {
  message: string
  status: number
  responseCode: ApiErrorCode
  exceptionKind: PostgresExceptionKind
  messageKey: PostgresErrorMessageKey
}

interface PostgresErrorCarrier {
  code?: unknown
  schema?: unknown
  constraint?: unknown
  table?: unknown
  column?: unknown
  cause?: unknown
}

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/

const POSTGRES_ERROR_DESCRIPTORS: Record<
  PostgresErrorCodeValue,
  PostgresErrorResponseDescriptor
> = {
  [PostgresErrorCode.UNIQUE_VIOLATION]: {
    message: '数据已存在',
    status: HttpStatus.CONFLICT,
    responseCode: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
    exceptionKind: 'business',
    messageKey: 'duplicate',
  },
  [PostgresErrorCode.NOT_NULL_VIOLATION]: {
    message: '必填字段不能为空',
    status: HttpStatus.BAD_REQUEST,
    responseCode: PlatformErrorCode.BAD_REQUEST,
    exceptionKind: 'http',
    messageKey: 'notNull',
  },
  [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: {
    message: '关联数据不存在或仍被使用',
    status: HttpStatus.CONFLICT,
    responseCode: BusinessErrorCode.STATE_CONFLICT,
    exceptionKind: 'business',
    messageKey: 'foreignKey',
  },
  [PostgresErrorCode.CHECK_VIOLATION]: {
    message: '数据不符合要求',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    responseCode: PlatformErrorCode.VALIDATION_FAILED,
    exceptionKind: 'http',
    messageKey: 'check',
  },
  [PostgresErrorCode.EXCLUSION_VIOLATION]: {
    message: '数据状态冲突',
    status: HttpStatus.CONFLICT,
    responseCode: BusinessErrorCode.STATE_CONFLICT,
    exceptionKind: 'business',
    messageKey: 'conflict',
  },
  [PostgresErrorCode.SERIALIZATION_FAILURE]: {
    message: '操作冲突，请重试',
    status: HttpStatus.CONFLICT,
    responseCode: BusinessErrorCode.STATE_CONFLICT,
    exceptionKind: 'business',
    messageKey: 'conflict',
  },
  [PostgresErrorCode.DEADLOCK_DETECTED]: {
    message: '操作冲突，请重试',
    status: HttpStatus.CONFLICT,
    responseCode: BusinessErrorCode.STATE_CONFLICT,
    exceptionKind: 'business',
    messageKey: 'conflict',
  },
}

const CONNECTION_ERROR_DESCRIPTOR: PostgresErrorResponseDescriptor = {
  message: '数据库服务暂不可用',
  status: HttpStatus.SERVICE_UNAVAILABLE,
  responseCode: PlatformErrorCode.SERVICE_UNAVAILABLE,
  exceptionKind: 'http',
  messageKey: 'serviceUnavailable',
}

/**
 * 将未知异常归类为安全 PostgreSQL 事实；业务层只能基于 facts 做显式分支。
 */
export function classifyPostgresError(
  error: unknown,
  options: PostgresErrorClassifierOptions = {},
): PostgresErrorFacts | null {
  return classifyPostgresErrorValue(error, options.source, new Set<object>())
}

/**
 * 根据 SQLSTATE 返回预定义的错误响应描述符；未知 sqlState 返回 null。
 */
export function getPostgresErrorResponseDescriptor(
  sqlState: string,
): PostgresErrorResponseDescriptor | null {
  if (!isSqlState(sqlState)) {
    return null
  }

  if (isKnownPostgresErrorCode(sqlState)) {
    return POSTGRES_ERROR_DESCRIPTORS[sqlState]
  }

  return sqlState.slice(0, 2) === '08' ? CONNECTION_ERROR_DESCRIPTOR : null
}

/**
 * 判断错误事实是否属于可重试类别（序列化失败或死锁）。
 */
export function isRetryablePostgresError(
  facts: PostgresErrorFacts,
  options: { retryDeadlock?: boolean } = {},
): boolean {
  return (
    facts.sqlState === PostgresErrorCode.SERIALIZATION_FAILURE ||
    (options.retryDeadlock === true &&
      facts.sqlState === PostgresErrorCode.DEADLOCK_DETECTED)
  )
}

// 递归遍历错误 cause 链，提取第一个可识别的 PostgreSQL 错误事实。
function classifyPostgresErrorValue(
  value: unknown,
  source: PostgresErrorSource | undefined,
  visited: Set<object>,
): PostgresErrorFacts | null {
  if (!isObject(value) || visited.has(value)) {
    return null
  }
  visited.add(value)

  if (value instanceof DrizzleQueryError) {
    return classifyPostgresErrorValue(value.cause, 'drizzle-query', visited)
  }

  const carrier = value as PostgresErrorCarrier
  const nested = classifyPostgresErrorValue(carrier.cause, source, visited)
  if (nested) {
    return nested
  }

  return buildFacts(carrier, source)
}

// 从错误 carrier 中提取 sqlState 并组装安全事实对象。
function buildFacts(
  carrier: PostgresErrorCarrier,
  requestedSource: PostgresErrorSource | undefined,
): PostgresErrorFacts | null {
  if (typeof carrier.code !== 'string' || !isSqlState(carrier.code)) {
    return null
  }

  const sqlState = carrier.code
  const sqlStateClass = sqlState.slice(0, 2)
  const source = requestedSource ?? 'postgres-driver'

  return {
    source,
    sqlState,
    sqlStateClass,
    category: getPostgresErrorCategory(sqlState),
    retryable: isRetryableSqlState(sqlState),
    schema: getString(carrier.schema),
    constraint: getString(carrier.constraint),
    table: getString(carrier.table),
    column: getString(carrier.column),
  }
}

// 根据 SQLSTATE class 前缀归类错误类别。
function getPostgresErrorCategory(sqlState: string): PostgresErrorCategory {
  const sqlStateClass = sqlState.slice(0, 2)
  if (sqlStateClass === '08') {
    return 'connection'
  }
  if (sqlStateClass === '23') {
    return 'integrity'
  }
  if (
    sqlState === PostgresErrorCode.SERIALIZATION_FAILURE ||
    sqlState === PostgresErrorCode.DEADLOCK_DETECTED
  ) {
    return 'transaction'
  }
  if (
    sqlStateClass === '42' ||
    sqlStateClass === '28' ||
    sqlStateClass === '3F'
  ) {
    return 'programming'
  }
  return 'unknown'
}

// 判断 sqlState 是否属于可重试类别（序列化失败或死锁）。
function isRetryableSqlState(sqlState: string): boolean {
  return (
    sqlState === PostgresErrorCode.SERIALIZATION_FAILURE ||
    sqlState === PostgresErrorCode.DEADLOCK_DETECTED
  )
}

// 校验字符串是否符合 SQLSTATE 五位字母数字格式。
function isSqlState(code: string): boolean {
  return SQLSTATE_PATTERN.test(code)
}

// 判断 code 是否属于已知 PostgreSQL 错误码常量。
function isKnownPostgresErrorCode(
  code: string,
): code is PostgresErrorCodeValue {
  return Object.values(PostgresErrorCode).includes(
    code as PostgresErrorCodeValue,
  )
}

// 类型守卫：判断值是否为非 null 对象。
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

// 从未知值中安全提取字符串，非字符串返回 undefined。
function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
