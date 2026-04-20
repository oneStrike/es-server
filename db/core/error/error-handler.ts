import type { DrizzleErrorMessages } from '../drizzle.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common'
import {
  getPostgresError,
  PostgresDefaultMessages,
  PostgresErrorCode,
  type PostgresErrorSource,
} from './postgres-error'

type PostgresErrorInput = PostgresErrorSource

export function isErrorCode(error: PostgresErrorInput, code: string) {
  const pgError = getPostgresError(error)
  return pgError !== null && pgError.code === code
}

export function isUniqueViolation(error: PostgresErrorInput) {
  return isErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)
}

export function isNotNullViolation(error: PostgresErrorInput) {
  return isErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION)
}

export function isCheckViolation(error: PostgresErrorInput) {
  return isErrorCode(error, PostgresErrorCode.CHECK_VIOLATION)
}

export function isSerializationFailure(error: PostgresErrorInput) {
  return isErrorCode(error, PostgresErrorCode.SERIALIZATION_FAILURE)
}

export function extractError(error: PostgresErrorInput) {
  return getPostgresError(error)
}

export function handleError(
  error: PostgresErrorInput,
  messages?: DrizzleErrorMessages,
): never {
  if (error instanceof BusinessException || error instanceof HttpException) {
    throw error
  }

  const pgError = getPostgresError(error)
  if (!pgError) {
    throw error
  }

  const { code } = pgError

  const messageMap: Record<string, string | undefined> = {
    [PostgresErrorCode.UNIQUE_VIOLATION]: messages?.duplicate,
    [PostgresErrorCode.NOT_NULL_VIOLATION]: messages?.notNull,
    [PostgresErrorCode.CHECK_VIOLATION]: messages?.check,
    [PostgresErrorCode.SERIALIZATION_FAILURE]: messages?.conflict,
  }

  let message = messageMap[code]
  if (!message) {
    message = PostgresDefaultMessages[code]
  }

  if (code === PostgresErrorCode.UNIQUE_VIOLATION) {
    throw new BusinessException(
      BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      message,
      {
        cause: error,
      },
    )
  }

  if (code === PostgresErrorCode.SERIALIZATION_FAILURE) {
    throw new BusinessException(BusinessErrorCode.STATE_CONFLICT, message, {
      cause: error,
    })
  }

  if (
    code === PostgresErrorCode.NOT_NULL_VIOLATION ||
    code === PostgresErrorCode.CHECK_VIOLATION
  ) {
    throw new BadRequestException(message, { cause: error })
  }

  throw new InternalServerErrorException('数据库操作失败', {
    cause: error,
  })
}

export async function executeWithErrorHandling<T>(
  fn: () => Promise<T>,
  messages?: DrizzleErrorMessages,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const postgresError =
      error instanceof Error
        ? error
        : typeof error === 'object' && error !== null
          ? error
          : undefined
    handleError(postgresError, messages)
  }
}
