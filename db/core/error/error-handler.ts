import type { DrizzleErrorMessages } from '../drizzle.type'
import type { PostgresError } from './postgres-error'
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
} from './postgres-error'

export function isErrorCode(error: unknown, code: string): boolean {
  const pgError = getPostgresError(error)
  return pgError !== null && pgError.code === code
}

export function isUniqueViolation(error: unknown): boolean {
  return isErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)
}

export function isNotNullViolation(error: unknown): boolean {
  return isErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION)
}

export function isCheckViolation(error: unknown): boolean {
  return isErrorCode(error, PostgresErrorCode.CHECK_VIOLATION)
}

export function isSerializationFailure(error: unknown): boolean {
  return isErrorCode(error, PostgresErrorCode.SERIALIZATION_FAILURE)
}

export function extractError(error: unknown): PostgresError | null {
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
    handleError(error, messages)
  }
}
