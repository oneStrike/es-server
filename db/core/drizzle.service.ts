import type {
  Db,
  DrizzleErrorMessages,
  DrizzleWhere,
  DrizzleWhereNode,
  PgTable,
} from './drizzle.type'
import type { PostgresError } from './error/postgres-error'
import {
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common'
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
  isForeignKeyViolation,
  isNotNullViolation,
  isSerializationFailure,
  isUniqueViolation,
} from './error/error-handler'
import { buildDrizzleWhere } from './query/where-builder'

@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly ext: ReturnType<typeof createDrizzleExtensions>

  constructor(
    @Inject(DRIZZLE_DB) public readonly db: Db,
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {
    this.ext = createDrizzleExtensions(this.db)
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }

  get schema(): typeof schema {
    return schema
  }

  buildWhere<TTable extends PgTable>(
    table: TTable,
    node?: DrizzleWhereNode<TTable>,
  ): DrizzleWhere {
    return buildDrizzleWhere(table, node)
  }

  isErrorCode(error: unknown, code: string): boolean {
    return isErrorCode(error, code)
  }

  isUniqueViolation(error: unknown): boolean {
    return isUniqueViolation(error)
  }

  isForeignKeyViolation(error: unknown): boolean {
    return isForeignKeyViolation(error)
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
}
