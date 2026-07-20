import type {
  DatabaseErrorDiagnostic,
  DrizzleErrorMessages,
} from '../drizzle.type'
import type { PostgresErrorClassifierOptions } from './postgres-error'
import { isBusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { HttpException, InternalServerErrorException } from '@nestjs/common'
import {
  classifyPostgresError,
  getPostgresErrorResponseDescriptor,
} from './postgres-error'

const DATABASE_OPERATION_FAILED_MESSAGE = '数据库操作失败'
const SAFE_ERROR_NAME_PATTERN = /^[a-z][\w.-]{0,63}$/i

export function throwDatabaseException(
  error: unknown,
  messages?: DrizzleErrorMessages,
): never {
  if (error instanceof BusinessException || error instanceof HttpException) {
    throw error
  }

  const facts = classifyPostgresError(error)
  if (!facts) {
    if (error instanceof Error) {
      throw error
    }

    throw new InternalServerErrorException(DATABASE_OPERATION_FAILED_MESSAGE, {
      cause: error,
    })
  }

  const descriptor = getPostgresErrorResponseDescriptor(facts.sqlState)
  if (!descriptor) {
    throw new InternalServerErrorException(DATABASE_OPERATION_FAILED_MESSAGE, {
      cause: error,
    })
  }

  const message = messages?.[descriptor.messageKey] ?? descriptor.message

  if (descriptor.exceptionKind === 'business') {
    if (!isBusinessErrorCode(descriptor.responseCode)) {
      throw new InternalServerErrorException('数据库错误映射配置错误', {
        cause: error,
      })
    }

    throw new BusinessException(descriptor.responseCode, message, {
      httpStatus: descriptor.status,
      cause: error,
    })
  }

  throw new HttpException(message, descriptor.status, { cause: error })
}

export async function executeWithErrorHandling<T>(
  fn: () => Promise<T>,
  messages?: DrizzleErrorMessages,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throwDatabaseException(error, messages)
  }
}

export function buildSafeDatabaseDiagnostic(
  error: unknown,
  options?: PostgresErrorClassifierOptions,
): DatabaseErrorDiagnostic {
  const facts = classifyPostgresError(error, options)
  return {
    errorName: getSafeErrorName(error),
    facts,
    stackFrames: getSafeStackFrames(error),
  }
}

function getSafeErrorName(error: unknown): string {
  if (
    error instanceof Error &&
    error.name &&
    SAFE_ERROR_NAME_PATTERN.test(error.name)
  ) {
    return error.name
  }
  return 'UnknownDatabaseError'
}

function getSafeStackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== 'string') {
    return []
  }

  return error.stack
    .split('\n')
    .slice(1)
    .map((frame) => frame.trim())
    .filter((frame) => frame.length > 0 && isSafeStackFrame(frame))
    .slice(0, 8)
}

function isSafeStackFrame(frame: string): boolean {
  return (
    frame.startsWith('at ') &&
    !frame.includes('password=') &&
    !frame.includes('://')
  )
}
