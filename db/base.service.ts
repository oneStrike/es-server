import type { Db } from './index'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'

const PG_UNIQUE_VIOLATION = '23505'
const PG_NO_DATA_FOUND = 'P0002'
const PG_SERIALIZATION_FAILURE = '40001'
const PG_DEADLOCK_DETECTED = '40P01'

@Injectable()
export abstract class DrizzleBaseService {
  @Inject('DrizzleDb')
  /** Drizzle 数据库实例注入 */
  protected drizzleDb!: Db

  /** 获取 Drizzle 数据库实例 */
  protected get db(): Db {
    return this.drizzleDb
  }

  /** 检查错误是否匹配指定的 PostgreSQL SQLSTATE 错误码 */
  protected isPgErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === code
    )
  }

  /** PostgreSQL 唯一约束冲突错误 (23505) */
  isUniqueConstraintError(error: unknown): boolean {
    return this.isPgErrorCode(error, PG_UNIQUE_VIOLATION)
  }

  /**
   * PostgreSQL 未找到记录错误 (P0002)
   * 通常用于函数/存储过程的 NO_DATA_FOUND，不适用于常规 SELECT。
   */
  isRecordNotFound(error: unknown): boolean {
    return this.isPgErrorCode(error, PG_NO_DATA_FOUND)
  }

  /** PostgreSQL 事务冲突/序列化失败错误 (40001/40P01) */
  isTransactionConflict(error: unknown): boolean {
    return (
      this.isPgErrorCode(error, PG_SERIALIZATION_FAILURE) ||
      this.isPgErrorCode(error, PG_DEADLOCK_DETECTED)
    )
  }

  /** 通用 Drizzle/PostgreSQL 错误映射器 */
  protected handleDrizzleError<T = never>(
    error: unknown,
    handlers: Partial<Record<string, () => T>>,
  ): T {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      const code = (error as { code: string }).code
      const handler = handlers[code]
      if (handler) {
        return handler()
      }
    }

    throw error
  }

  /**
   * 将常见的 PostgreSQL 业务错误映射为 BadRequestException 消息。
   * 使用语义化字段替代在每个服务中硬编码 SQLSTATE。
   */
  protected handleDrizzleBusinessError(
    error: unknown,
    options: {
      duplicateMessage?: string
      notFoundMessage?: string
      conflictMessage?: string
    },
  ): never {
    const handlers: Partial<Record<string, () => never>> = {}

    if (options.duplicateMessage) {
      handlers[PG_UNIQUE_VIOLATION] = () => {
        throw new BadRequestException(options.duplicateMessage)
      }
    }
    if (options.notFoundMessage) {
      handlers[PG_NO_DATA_FOUND] = () => {
        throw new BadRequestException(options.notFoundMessage)
      }
    }
    if (options.conflictMessage) {
      handlers[PG_SERIALIZATION_FAILURE] = () => {
        throw new BadRequestException(options.conflictMessage)
      }
      handlers[PG_DEADLOCK_DETECTED] = () => {
        throw new BadRequestException(options.conflictMessage)
      }
    }

    return this.handleDrizzleError(error, handlers)
  }

  /** 事务冲突重试辅助方法 */
  protected async withTransactionConflictRetry<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number
    },
  ): Promise<T> {
    const maxRetries = Math.max(1, options?.maxRetries ?? 3)
    let lastError: unknown = new Error('事务冲突重试次数已耗尽')

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (!this.isTransactionConflict(error) || attempt >= maxRetries - 1) {
          throw error
        }
      }
    }

    throw lastError
  }
}
