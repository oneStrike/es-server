import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common'
import { Pool } from 'pg'
import {
  formatUniqueViolationMessage,
  getPostgresError,
  PostgresDefaultMessages,
  PostgresError,
  PostgresErrorCode,
} from './constants/postgres-error'
import { createDrizzleExtensions } from './drizzle.extensions'
import { Db, DRIZZLE_DB, DRIZZLE_POOL } from './drizzle.provider'
import * as schema from './schema'

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
    const pgError = getPostgresError(error)
    return pgError !== null && pgError.code === code
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
    const pgError = getPostgresError(error)
    if (!pgError) {
      throw error
    }

    const { code } = pgError

    // 构建消息映射
    const messageMap: Record<string, string | undefined> = {
      [PostgresErrorCode.UNIQUE_VIOLATION]: messages?.duplicate,
      [PostgresErrorCode.FOREIGN_KEY_VIOLATION]: messages?.foreignKey,
      [PostgresErrorCode.NOT_NULL_VIOLATION]: messages?.notNull,
      [PostgresErrorCode.CHECK_VIOLATION]: messages?.check,
      [PostgresErrorCode.SERIALIZATION_FAILURE]: messages?.conflict,
    }

    // 优先使用自定义消息，否则使用格式化的默认消息
    let message = messageMap[code]
    if (!message) {
      // 唯一约束错误使用格式化消息
      if (code === PostgresErrorCode.UNIQUE_VIOLATION) {
        message = formatUniqueViolationMessage(
          pgError,
          PostgresDefaultMessages[code],
        )
      } else {
        message = PostgresDefaultMessages[code]
      }
    }

    if (message) {
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
    return getPostgresError(error)
  }
}
