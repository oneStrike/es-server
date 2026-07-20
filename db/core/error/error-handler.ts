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

/**
 * 将数据库异常翻译为业务异常或 HTTP 异常，支持自定义错误消息覆盖。
 */
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

/**
 * 执行异步函数并在抛出异常时统一翻译为业务异常。
 */
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

/**
 * 构建安全可日志输出的数据库诊断信息，过滤掉 query、params、detail 等敏感字段。
 */
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

// 从未知错误中提取符合命名规范的安全 error name，不满足模式时返回兜底值。
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

// 从错误堆栈中提取安全帧，过滤掉含密码或连接字符串的敏感行。
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

// 判断堆栈帧是否安全可日志输出，排除含密码或协议链接的行。
function isSafeStackFrame(frame: string): boolean {
  return (
    frame.startsWith('at ') &&
    !frame.includes('password=') &&
    !frame.includes('://')
  )
}
