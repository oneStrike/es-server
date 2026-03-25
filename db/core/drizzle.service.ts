import type {
  DbQueryConfig,
  DbQueryOrderBy,
  DbQueryOrderByRecord,
} from '@libs/platform/config'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { Db, DrizzleErrorMessages, SQL } from './drizzle.type'
import type { PostgresError } from './error/postgres-error'
import type {
  DrizzlePageQueryInput,
  DrizzlePageQueryOptions,
  DrizzlePageQueryResult,
} from './query/page-query'
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { asc, desc, getTableColumns } from 'drizzle-orm'
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
    const pageIndex = input.pageIndex || this.queryConfig.pageIndex
    const pageSize = input.pageSize
      ? input.pageSize > this.queryConfig.maxListItemLimit
        ? input.maxPageSize
          ? input.maxPageSize
          : this.queryConfig.maxListItemLimit
        : input.pageSize
      : this.queryConfig.pageSize

    return {
      pageIndex,
      pageSize,
      limit: pageSize,
      offset: (pageIndex - 1) * pageSize,
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
    const validColumns = getTableColumns(table) as Record<string, unknown>
    const rawOrderBy = orderBy ?? this.queryConfig.orderBy

    let parsedOrderBy: DbQueryOrderBy | undefined
    if (rawOrderBy === undefined || rawOrderBy === null) {
      parsedOrderBy = undefined
    } else if (typeof rawOrderBy === 'string') {
      if (!rawOrderBy.trim()) {
        parsedOrderBy = undefined
      } else {
        try {
          parsedOrderBy = JSON.parse(rawOrderBy) as DbQueryOrderBy
        } catch {
          throw new BadRequestException('orderBy 参数格式不合法')
        }
      }
    } else if (Array.isArray(rawOrderBy)) {
      parsedOrderBy = rawOrderBy as DbQueryOrderBy
    } else if (typeof rawOrderBy === 'object') {
      parsedOrderBy = rawOrderBy as DbQueryOrderBy
    } else {
      throw new BadRequestException('orderBy 参数格式不合法')
    }

    let normalizedOrderBy: DbQueryOrderBy | undefined
    if (!parsedOrderBy) {
      normalizedOrderBy = undefined
    } else {
      const records = Array.isArray(parsedOrderBy)
        ? parsedOrderBy
        : [parsedOrderBy]
      if (records.length === 0) {
        throw new BadRequestException('orderBy 不能为空')
      }

      const normalizedRecords: DbQueryOrderByRecord[] = []
      for (const record of records) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
          throw new BadRequestException('orderBy 参数格式不合法')
        }

        const entries = Object.entries(record as Record<string, unknown>)
        if (entries.length === 0) {
          throw new BadRequestException('orderBy 不能为空')
        }

        const normalizedRecord: DbQueryOrderByRecord = {}
        for (const [field, direction] of entries) {
          if (!validColumns[field]) {
            throw new BadRequestException(`排序字段 "${field}" 不存在`)
          }

          let normalizedDirection: 'asc' | 'desc' | undefined
          if (direction === 'asc' || direction === 'desc') {
            normalizedDirection = direction
          } else if (typeof direction === 'string') {
            const normalized = direction.toLowerCase()
            normalizedDirection =
              normalized === 'asc' || normalized === 'desc'
                ? normalized
                : undefined
          }

          if (!normalizedDirection) {
            throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
          }

          normalizedRecord[field] = normalizedDirection
        }

        normalizedRecords.push(normalizedRecord)
      }

      normalizedOrderBy =
        normalizedRecords.length === 1
          ? normalizedRecords[0]
          : normalizedRecords
    }

    if (!normalizedOrderBy && validColumns.id) {
      normalizedOrderBy = { id: 'desc' }
    }

    if (normalizedOrderBy && validColumns.id) {
      const records = Array.isArray(normalizedOrderBy)
        ? [...normalizedOrderBy]
        : [normalizedOrderBy]
      if (!records.some((record) => Object.hasOwn(record, 'id'))) {
        let idDirection: 'asc' | 'desc' = 'desc'
        for (
          let recordIndex = records.length - 1;
          recordIndex >= 0;
          recordIndex -= 1
        ) {
          const lastDirection = Object.values(records[recordIndex]).at(-1)
          if (lastDirection === 'asc' || lastDirection === 'desc') {
            idDirection = lastDirection
            break
          }
        }
        normalizedOrderBy = [...records, { id: idDirection }]
      }
    }

    const orderBySql: SQL[] = []
    if (normalizedOrderBy) {
      const records = Array.isArray(normalizedOrderBy)
        ? normalizedOrderBy
        : [normalizedOrderBy]

      for (const record of records) {
        for (const [field, direction] of Object.entries(record)) {
          const column = validColumns[field]
          if (!column) {
            continue
          }

          orderBySql.push(
            direction === 'asc' ? asc(column as never) : desc(column as never),
          )
        }
      }
    }

    return {
      orderBy: normalizedOrderBy,
      orderBySql,
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
