import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { Pool } from 'pg'
import { createDrizzleExtensions } from './drizzle.extensions'
import { Db, DRIZZLE_DB, DRIZZLE_POOL } from './drizzle.provider'
import * as schema from './schema'
import {
  isPostgresError,
  PostgresDefaultMessages,
  PostgresErrorCode,
  PostgresError,
} from './constants/postgres-error'

/**
 * Drizzle 数据库服务
 * 提供数据库连接管理、扩展功能和错误处理
 */
@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  /** Drizzle 扩展方法集合 */
  public readonly ext: ReturnType<typeof createDrizzleExtensions>

  constructor(
    /** Drizzle 数据库实例 */
    @Inject(DRIZZLE_DB) public readonly db: Db,
    /** PostgreSQL 连接池 */
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {
    this.ext = createDrizzleExtensions(this.db)
  }

  /** 获取数据库 Schema 定义 */
  get schema(): typeof schema {
    return schema
  }

  /**
   * 应用程序关闭时的清理操作
   * 关闭数据库连接池
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }

  // ==================== 错误检测方法 ====================

  /**
   * 检查错误是否匹配指定的 PostgreSQL 错误码
   * @param error 捕获的错误
   * @param code PostgreSQL 错误码
   */
  isErrorCode(error: unknown, code: string): boolean {
    return isPostgresError(error) && error.code === code
  }

  /**
   * 是否为唯一约束冲突 (23505)
   * @param error 捕获的错误
   */
  isUniqueViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.UNIQUE_VIOLATION)
  }

  /**
   * 是否为外键约束冲突 (23503)
   * @param error 捕获的错误
   */
  isForeignKeyViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.FOREIGN_KEY_VIOLATION)
  }

  /**
   * 是否为非空约束冲突 (23502)
   * @param error 捕获的错误
   */
  isNotNullViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.NOT_NULL_VIOLATION)
  }

  /**
   * 是否为检查约束冲突 (23514)
   * @param error 捕获的错误
   */
  isCheckViolation(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.CHECK_VIOLATION)
  }

  /**
   * 是否为事务序列化失败 (40001)
   * @param error 捕获的错误
   */
  isSerializationFailure(error: unknown): boolean {
    return this.isErrorCode(error, PostgresErrorCode.SERIALIZATION_FAILURE)
  }

  // ==================== 错误处理方法 ====================

  /**
   * 处理数据库错误，转换为业务异常
   * @param error 捕获的错误
   * @param messages 自定义消息映射
   * @throws BadRequestException | ConflictException
   */
  handleError(
    error: unknown,
    messages?: {
      /** 唯一约束冲突消息 */
      duplicate?: string
      /** 外键约束冲突消息 */
      foreignKey?: string
      /** 非空约束冲突消息 */
      notNull?: string
      /** 检查约束冲突消息 */
      check?: string
      /** 事务冲突消息 */
      conflict?: string
    },
  ): never {
    if (!isPostgresError(error)) {
      throw error
    }

    const { code } = error
    const messageMap = {
      [PostgresErrorCode.UNIQUE_VIOLATION]: messages?.duplicate,
      [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: messages?.foreignKey,
      [PostgresErrorCode.NOT_NULL_VIOLATION]: messages?.notNull,
      [PostgresErrorCode.CHECK_VIOLATION]: messages?.check,
      [PostgresErrorCode.SERIALIZATION_FAILURE]: messages?.conflict,
    }

    // 使用自定义消息或默认消息
    const message = messageMap[code] ?? PostgresDefaultMessages[code]

    if (message) {
      // 动态导入避免循环依赖
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BadRequestException, ConflictException } = require('@nestjs/common')
      const isConflict =
        code === PostgresErrorCode.UNIQUE_VIOLATION ||
        code === PostgresErrorCode.SERIALIZATION_FAILURE

      throw isConflict
        ? new ConflictException(message)
        : new BadRequestException(message)
    }

    // 未知错误码，抛出原始错误
    throw error
  }

  /**
   * 从错误中提取 PostgreSQL 错误信息
   * @param error 捕获的错误
   * @returns PostgreSQL 错误信息或 null
   */
  extractError(error: unknown): PostgresError | null {
    if (!isPostgresError(error)) {
      return null
    }
    return {
      code: error.code,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      detail: error.detail,
      message: error.message,
    }
  }

  // ==================== 重试机制 ====================

  /**
   * 事务冲突自动重试
   * @param fn 要执行的操作
   * @param maxRetries 最大重试次数，默认 3
   */
  async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown = new Error('事务冲突重试次数已耗尽')

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (!this.isSerializationFailure(error) || attempt >= maxRetries - 1) {
          throw error
        }
      }
    }

    throw lastError
  }
}
