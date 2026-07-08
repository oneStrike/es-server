import type { DrizzleErrorMessages } from '../drizzle.type'
import { isBusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { HttpException, InternalServerErrorException } from '@nestjs/common'
import {
  getPostgresError,
  getPostgresErrorResponseDescriptor,
  PostgresErrorCode,
} from './postgres-error'

export function isErrorCode(error: unknown, code: string) {
  const pgError = getPostgresError(error)
  return pgError !== null && pgError.code === code
}

export function isUniqueViolation(error: unknown) {
  return isErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)
}

export function isNotNullViolation(error: unknown) {
  return isErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION)
}

export function isCheckViolation(error: unknown) {
  return isErrorCode(error, PostgresErrorCode.CHECK_VIOLATION)
}

export function isSerializationFailure(error: unknown) {
  return isErrorCode(error, PostgresErrorCode.SERIALIZATION_FAILURE)
}

export function extractError(error: unknown) {
  return getPostgresError(error)
}

export function handleError(
  error: unknown,
  messages?: DrizzleErrorMessages,
): never {
  if (error instanceof BusinessException || error instanceof HttpException) {
    throw error
  }

  const pgError = getPostgresError(error)
  if (!pgError) {
    if (error instanceof Error) {
      throw error
    }

    throw new InternalServerErrorException('数据库操作失败', {
      cause: error,
    })
  }

  const descriptor = getPostgresErrorResponseDescriptor(pgError.code)
  if (!descriptor) {
    throw new InternalServerErrorException('数据库操作失败', {
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
    handleError(error, messages)
  }
}
