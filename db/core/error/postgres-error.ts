import type { ApiErrorCode } from '@libs/platform/constant'
import { BusinessErrorCode, PlatformErrorCode } from '@libs/platform/constant'
import { HttpStatus } from '@nestjs/common'

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
  /** 检查约束冲突 */
  CHECK_VIOLATION: '23514',
  /** 事务序列化失败 */
  SERIALIZATION_FAILURE: '40001',
  /** 事务死锁 */
  DEADLOCK_DETECTED: '40P01',
} as const

export type PostgresErrorCodeValue =
  (typeof PostgresErrorCode)[keyof typeof PostgresErrorCode]

export type PostgresExceptionKind = 'business' | 'http'

export type PostgresErrorMessageKey =
  'duplicate' | 'notNull' | 'check' | 'conflict'

/** 规范化后的 PostgreSQL 错误元信息。 */
export interface PostgresError {
  code: string
  constraint?: string
  table?: string
  column?: string
  detail?: string
  message: string
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
  constraint?: unknown
  table?: unknown
  column?: unknown
  detail?: unknown
  message?: unknown
  cause?: unknown
}

const DATABASE_OPERATION_FAILED_MESSAGE = '数据库操作失败'

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
  [PostgresErrorCode.CHECK_VIOLATION]: {
    message: '数据不符合要求',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    responseCode: PlatformErrorCode.VALIDATION_FAILED,
    exceptionKind: 'http',
    messageKey: 'check',
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

/**
 * 从未知异常中提取 PostgreSQL 错误信息。
 *
 * 支持 driver 错误直接抛出，以及 Drizzle/Nest 包装后通过 `cause` 保留原始错误。
 */
export function getPostgresError(error: unknown): PostgresError | null {
  return getPostgresErrorFromValue(error, undefined, new Set<object>())
}

export function getPostgresErrorResponseDescriptor(
  code: string,
): PostgresErrorResponseDescriptor | null {
  return isKnownPostgresErrorCode(code)
    ? POSTGRES_ERROR_DESCRIPTORS[code]
    : null
}

function normalizeCarrier(
  value: unknown,
  fallbackMessage?: string,
): PostgresError | null {
  const carrier = asCarrier(value)
  if (!carrier || typeof carrier.code !== 'string') {
    return null
  }

  return {
    code: carrier.code,
    constraint: getString(carrier.constraint),
    table: getString(carrier.table),
    column: getString(carrier.column),
    detail: getString(carrier.detail),
    message:
      getString(carrier.message) ??
      fallbackMessage ??
      getPostgresErrorResponseDescriptor(carrier.code)?.message ??
      DATABASE_OPERATION_FAILED_MESSAGE,
  }
}

function getPostgresErrorFromValue(
  value: unknown,
  fallbackMessage: string | undefined,
  visited: Set<object>,
): PostgresError | null {
  const directError = normalizeCarrier(value, fallbackMessage)
  if (directError) {
    return directError
  }

  const source = asCarrier(value)
  if (!source || visited.has(source)) {
    return null
  }
  visited.add(source)

  return getPostgresErrorFromValue(
    source.cause,
    getString(source.message) ?? fallbackMessage,
    visited,
  )
}

function asCarrier(value: unknown): PostgresErrorCarrier | null {
  return typeof value === 'object' && value !== null ? value : null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isKnownPostgresErrorCode(
  code: string,
): code is PostgresErrorCodeValue {
  return Object.values(PostgresErrorCode).includes(
    code as PostgresErrorCodeValue,
  )
}
