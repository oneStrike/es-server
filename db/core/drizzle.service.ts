import type { DbQueryConfig } from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { Db, DrizzleErrorMessages } from './drizzle.type'
import type { PostgresError } from './error/postgres-error'
import type {
  DrizzlePageQueryInput,
  DrizzlePageQueryOptions,
  DrizzlePageQueryResult,
} from './query/page-query'
import {
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common'
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
import { buildDrizzlePageQuery } from './query/page-query'

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

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }

  get schema(): typeof schema {
    return schema
  }

  /**
   * 独立构建分页边界。
   * 用于只需要 pageIndex/pageSize/limit/offset 的手工分页场景。
   */
  buildPaginationBounds(input: {
    pageIndex?: number
    pageSize?: number
    maxPageSize?: number
  }) {
    const pageQuery = this.buildPageQuery(input, {
      maxPageSize: input.maxPageSize,
    })

    return {
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
      limit: pageQuery.limit,
      offset: pageQuery.offset,
    }
  }

  /**
   * 独立构建表级排序。
   * 用于需要严格校验字段并生成 Drizzle `orderBySql` 的场景。
   */
  buildTableOrderBy<TTable extends AnyPgTable>(
    table: TTable,
    orderBy?: unknown,
  ) {
    const pageQuery = this.buildPageQuery(
      {
        orderBy,
      },
      {
        table,
      },
    )

    return {
      orderBy: pageQuery.orderBy,
      orderBySql: pageQuery.orderBySql,
    }
  }

  buildPageQuery<TTable extends AnyPgTable>(
    input?: DrizzlePageQueryInput,
    options?: DrizzlePageQueryOptions<TTable>,
  ): DrizzlePageQueryResult {
    return buildDrizzlePageQuery(input, {
      ...options,
      defaults: {
        ...this.queryConfig,
        ...options?.defaults,
        orderBy: options?.defaults?.orderBy ?? this.queryConfig.orderBy,
      },
    })
  }

  isErrorCode(error: unknown, code: string): boolean {
    return isErrorCode(error, code)
  }

  isUniqueViolation(error: unknown): boolean {
    return isUniqueViolation(error)
  }

  isNotNullViolation(error: unknown): boolean {
    return isNotNullViolation(error)
  }

  isCheckViolation(error: unknown): boolean {
    return isCheckViolation(error)
  }

  isSerializationFailure(error: unknown): boolean {
    return isSerializationFailure(error)
  }

  extractError(error: unknown): PostgresError | null {
    return extractError(error)
  }

  handleError(error: unknown, messages?: DrizzleErrorMessages): never {
    return handleError(error, messages)
  }

  assertNotEmpty<T>(arr: T[], message = '记录不存在'): T[] {
    if (arr.length === 0) {
      throw new NotFoundException(message)
    }
    return arr
  }

  assertAffectedRows(
    result: { rowCount?: number | null } | unknown[],
    message = '记录不存在',
  ): void {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        throw new NotFoundException(message)
      }
      return
    }

    if (result?.rowCount === 0) {
      throw new NotFoundException(message)
    }
  }

  async withErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    return this.executeWithErrorHandling(fn, messages)
  }

  async withTransaction<T>(
    fn: (tx: Db) => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    return this.executeWithErrorHandling(
      async () => this.db.transaction(fn),
      messages,
    )
  }

  private async executeWithErrorHandling<T>(
    fn: () => Promise<T>,
    messages?: DrizzleErrorMessages,
  ): Promise<T> {
    return executeWithErrorHandling(fn, messages)
  }

  private resolveQueryConfig(): DbQueryConfig {
    const queryConfig = this.configService.get<DbQueryConfig>('db.query')
    return {
      pageSize: queryConfig?.pageSize ?? 15,
      pageIndex: queryConfig?.pageIndex ?? 1,
      maxListItemLimit: queryConfig?.maxListItemLimit ?? 500,
      orderBy: queryConfig?.orderBy ?? { id: 'desc' },
    }
  }
}
