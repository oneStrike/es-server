import type { DbQueryConfig } from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type {
  Db,
  DrizzleErrorMessages,
  DrizzleMutationResult,
  DrizzleTransactionOptions,
  DrizzleTransactionRetryOptions,
} from './drizzle.type'
import type { PostgresErrorFacts } from './error/postgres-error'
import type {
  AllowlistedOrderByOptions,
  DrizzleOrderByInput,
  DrizzleOrderByOptions,
} from './query/order-by'
import type {
  DrizzlePageParamsInput,
  DrizzlePageParamsOptions,
} from './query/page-params'
import type {
  DrizzlePageQueryInput,
  DrizzlePageQueryOptions,
} from './query/page-query'
import * as schema from '@db/schema'
import { resolveDbQueryConfig } from '@libs/platform/config'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DRIZZLE_DB } from './drizzle.provider'
import { executeWithErrorHandling } from './error/error-handler'
import {
  classifyPostgresError,
  isRetryablePostgresError,
} from './error/postgres-error'
import { buildAllowlistedOrderBy, buildDrizzleOrderBy } from './query/order-by'
import { buildDrizzlePageParams } from './query/page-params'
import { buildDrizzlePageQuery } from './query/page-query'

/**
 * 统一封装仓库级 Drizzle 入口、查询默认值和错误处理能力。
 */
@Injectable()
export class DrizzleService {
  private readonly logger = new Logger(DrizzleService.name)

  private readonly queryConfig: DbQueryConfig

  constructor(
    @Inject(DRIZZLE_DB) public readonly db: Db,
    private readonly configService: ConfigService,
  ) {
    this.queryConfig = this.resolveQueryConfig()
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
   * 一次性归一化完整 PageDto 参数，排序和日期范围只返回普通数据，由 owner service 显式组装查询条件。
   */
  buildPageParams<TTable extends AnyPgTable>(
    input: DrizzlePageParamsInput = {},
    options: Partial<DrizzlePageParamsOptions<TTable>> = {},
  ) {
    return buildDrizzlePageParams(input, {
      ...options,
      defaultPageIndex: options.defaultPageIndex ?? this.queryConfig.pageIndex,
      defaultPageSize: options.defaultPageSize ?? this.queryConfig.pageSize,
      maxPageSize: options.maxPageSize ?? this.queryConfig.maxListItemLimit,
    })
  }

  /**
   * 提供可复用的排序构造入口，供 findFirst、findMany 和手写查询共享同一套排序语义。
   */
  buildOrderBy<TTable extends AnyPgTable>(
    input?: DrizzleOrderByInput,
    options?: DrizzleOrderByOptions<TTable>,
  ) {
    return buildDrizzleOrderBy(input, options)
  }

  /**
   * 为原生 SQL 和派生字段分页提供受控排序入口，调用方必须传入显式字段白名单。
   */
  buildAllowlistedOrderBy(
    input: DrizzleOrderByInput,
    options: AllowlistedOrderByOptions,
  ) {
    return buildAllowlistedOrderBy(input, options)
  }

  /**
   * 将未知异常归类为安全 PostgreSQL 事实；业务层只能基于 facts 做显式分支。
   */
  classifyError(error: unknown): PostgresErrorFacts | null {
    return classifyPostgresError(error)
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
    const result = await executeWithErrorHandling(fn, messages)
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
  async withTransaction<T>({
    execute,
    config,
    messages,
    retry,
  }: DrizzleTransactionOptions<T>): Promise<T> {
    if (!retry) {
      return executeWithErrorHandling(
        async () => this.db.transaction(execute, config),
        messages,
      )
    }

    this.assertRetryOptions(retry)
    const maxAttempts = Math.max(1, Math.floor(retry.maxAttempts))
    const baseDelayMs = retry.baseDelayMs ?? 20
    const maxDelayMs = retry.maxDelayMs ?? 500
    const jitterRatio = retry.jitterRatio ?? 0.2
    let lastRetryFacts: PostgresErrorFacts | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await executeWithErrorHandling(
          async () => this.db.transaction(execute, config),
          messages,
        )
        if (lastRetryFacts) {
          this.logTransactionRetryMetric(lastRetryFacts, attempt, 'success')
        }
        return result
      } catch (error) {
        const facts = classifyPostgresError(error)
        const canRetry =
          facts !== null &&
          isRetryablePostgresError(facts, {
            retryDeadlock: retry.retryDeadlock === true,
          })
        const shouldRetry = attempt < maxAttempts && canRetry

        if (!shouldRetry) {
          if (facts) {
            this.logTransactionRetryMetric(
              facts,
              attempt,
              canRetry ? 'exhausted' : 'non-retryable',
            )
          }
          throw error
        }

        lastRetryFacts = facts
        this.logTransactionRetryMetric(facts, attempt, 'retrying')

        await this.delay(
          this.getRetryDelayMs(attempt, baseDelayMs, maxDelayMs, jitterRatio),
        )
      }
    }

    throw new Error('unreachable transaction retry state')
  }

  /**
   * 解析仓库级查询默认值，确保分页在未显式传参时仍有稳定回退行为。
   */
  private resolveQueryConfig() {
    return resolveDbQueryConfig(
      this.configService.get<Partial<DbQueryConfig>>('db.query'),
    )
  }

  private assertRetryOptions(retry: DrizzleTransactionRetryOptions) {
    if (retry.safeToRetry !== true) {
      throw new Error('transaction retry requires safeToRetry: true')
    }
    if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
      throw new Error('transaction retry requires maxAttempts >= 1')
    }
  }

  private getRetryDelayMs(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitterRatio: number,
  ) {
    const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
    const boundedJitterRatio = Math.max(0, Math.min(1, jitterRatio))
    const jitter = capped * boundedJitterRatio * Math.random()
    return Math.round(capped + jitter)
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private logTransactionRetryMetric(
    facts: PostgresErrorFacts,
    retryAttempt: number,
    retryOutcome: 'exhausted' | 'non-retryable' | 'retrying' | 'success',
  ) {
    this.logger.warn(
      JSON.stringify({
        event: 'database_transaction_retry',
        category: facts.category,
        sqlState: facts.sqlState,
        retryAttempt,
        retryOutcome,
        source: facts.source,
      }),
    )
  }
}
