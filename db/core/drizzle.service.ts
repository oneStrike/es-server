import type { DbQueryConfig } from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type {
  Db,
  DrizzleErrorMessages,
  DrizzleMutationResult,
} from './drizzle.type'
import type { PostgresError } from './error/postgres-error'
import type { DrizzleOrderByOptions } from './query/order-by'
import type {
  DrizzlePageQueryInput,
  DrizzlePageQueryOptions,
} from './query/page-query'
import { resolveDbQueryConfig } from '@libs/platform/config'
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool } from 'pg'
import * as schema from '../schema'
import { createDrizzleExtensions } from './drizzle.extensions'
import { DRIZZLE_DB, DRIZZLE_POOL } from './drizzle.provider'
import {
  executeWithErrorHandling,
  extractError,
  handleError,
  isCheckViolation,
  isErrorCode,
  isNotNullViolation,
  isSerializationFailure,
  isUniqueViolation,
} from './error/error-handler'
import { buildDrizzleOrderBy } from './query/order-by'
import { buildDrizzlePageQuery } from './query/page-query'
import { BusinessException } from '@libs/platform/exceptions'
import { BusinessErrorCode } from '@libs/platform/constant'

/**
 * 统一封装仓库级 Drizzle 入口、查询默认值和错误处理能力。
 */
@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly ext: ReturnType<typeof createDrizzleExtensions>
  private readonly queryConfig: DbQueryConfig

  constructor(
    @Inject(DRIZZLE_DB) public readonly db: Db,
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
    private readonly configService: ConfigService,
  ) {
    this.queryConfig = this.resolveQueryConfig()
    this.ext = createDrizzleExtensions(this.db, this.queryConfig)
  }

  /**
   * 在 Nest 应用退出时关闭连接池，避免测试和本地脚本残留数据库连接。
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }

  /**
   * 暴露只读 schema 入口，避免上层绕开统一的 DrizzleService 依赖注入。
   */
  get schema(): typeof schema {
    return schema
  }

  /**
   * 提供可复用的分页参数归一化入口，供手写分页、聚合查询和原生 SQL 共享统一的 1-based 分页契约。
   */
  buildPage(
    input: DrizzlePageQueryInput = {},
    options: Partial<DrizzlePageQueryOptions> = {},
  ) {
    return buildDrizzlePageQuery(input, {
      defaultPageIndex: options.defaultPageIndex ?? this.queryConfig.pageIndex,
      defaultPageSize: options.defaultPageSize ?? this.queryConfig.pageSize,
      maxPageSize: options.maxPageSize ?? this.queryConfig.maxListItemLimit,
    })
  }

  /**
   * 提供可复用的排序构造入口，供 findFirst、findMany 和手写查询共享同一套排序语义。
   */
  buildOrderBy<TTable extends AnyPgTable>(
    input?: unknown,
    options?: DrizzleOrderByOptions<TTable>,
  ) {
    return buildDrizzleOrderBy(input, options)
  }

  /**
   * 暴露错误码判断，供需要保留 PostgreSQL 原始错误语义的业务路径复用。
   */
  isErrorCode(error: unknown, code: string): boolean {
    return isErrorCode(error, code)
  }

  /**
   * 判断错误是否来自唯一约束冲突，避免业务层直接解析数据库驱动错误。
   */
  isUniqueViolation(error: unknown): boolean {
    return isUniqueViolation(error)
  }

  /**
   * 判断错误是否来自非空约束冲突。
   */
  isNotNullViolation(error: unknown): boolean {
    return isNotNullViolation(error)
  }

  /**
   * 判断错误是否来自 check constraint 失败。
   */
  isCheckViolation(error: unknown): boolean {
    return isCheckViolation(error)
  }

  /**
   * 判断错误是否为可重试的序列化失败。
   */
  isSerializationFailure(error: unknown): boolean {
    return isSerializationFailure(error)
  }

  /**
   * 从未知异常中提取 PostgreSQL 错误元信息，供上层做业务分支或日志输出。
   */
  extractError(error: unknown): PostgresError | null {
    return extractError(error)
  }

  /**
   * 统一将底层数据库异常翻译为业务可消费的 Nest 异常。
   */
  handleError(error: unknown, messages?: DrizzleErrorMessages): never {
    return handleError(error, messages)
  }

  /**
   * 断言数组结果非空，适合需要“至少一条记录”语义的查询结果。
   */
  assertNotEmpty<T>(arr: T[], message = '记录不存在'): T[] {
    if (arr.length === 0) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, message)
    }
    return arr
  }

  /**
   * 断言 update/delete 或查询结果确实命中了记录，避免业务层忽略 0 行变更。
   */
  assertAffectedRows(result: DrizzleMutationResult, message = '记录不存在') {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          message,
        )
      }
      return
    }

    if (result?.rowCount === 0) {
      throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, message)
    }
  }

  /**
   * 在非事务场景下复用统一的数据库异常处理策略。
   * 当显式传入 `notFound` 时，额外收口“0 行变更/空 returning” 的资源不存在语义。
   */
  async withErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    const result = await this.executeWithErrorHandling(fn, messages)
    if (messages?.notFound) {
      this.assertAffectedRows(
        result as DrizzleMutationResult,
        messages.notFound,
      )
    }
    return result
  }

  /**
   * 启动事务并复用统一异常翻译，要求调用链继续显式透传 tx。
   */
  async withTransaction<T>(
    fn: (tx: Db) => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    return this.executeWithErrorHandling(
      async () => this.db.transaction(fn),
      messages,
    )
  }

  /**
   * 收敛底层异常处理实现，避免公共方法各自复制相同的包装逻辑。
   */
  private async executeWithErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    return executeWithErrorHandling(fn, messages)
  }

  /**
   * 解析仓库级查询默认值，确保分页在未显式传参时仍有稳定回退行为。
   */
  private resolveQueryConfig() {
    return resolveDbQueryConfig(
      this.configService.get<Partial<DbQueryConfig>>('db.query'),
    )
  }
}
