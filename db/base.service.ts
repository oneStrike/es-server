import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import { Inject, Injectable } from '@nestjs/common'
import { and, isNull } from 'drizzle-orm'
import { Db, DrizzleService } from './drizzle.provider'
import * as schema from './schema'

type SchemaTables = typeof schema
type TableName = keyof SchemaTables

/**
 * 提取指定表的类型
 * 通过索引访问和 Extract 确保类型正确推导
 */
type GetTable<TName extends TableName> = Extract<
  SchemaTables[TName],
  PgTable<TableConfig>
>

/**
 * Drizzle 基础服务抽象类
 */
@Injectable()
export abstract class DrizzleBaseService<TName extends TableName = TableName> {
  protected readonly schema = schema

  constructor(
    @Inject(DrizzleService) protected readonly drizzleService: DrizzleService,
    protected readonly tableName: TName,
  ) {}

  protected get db(): Db {
    return this.drizzleService.db
  }

  protected get table(): GetTable<TName> {
    return this.schema[this.tableName] as GetTable<TName>
  }

  protected async exists(where: SQL | undefined): Promise<boolean> {
    const result = await this.db
      .select()
      .from(this.schema[this.tableName] as PgTable<TableConfig>)
      .where(where)
      .limit(1)

    return result.length > 0
  }

  protected async existsActive(where: SQL | undefined): Promise<boolean> {
    const tableInstance = this.schema[this.tableName]
    const tableAsRecord = tableInstance as unknown as Record<string, SQLWrapper>
    const deletedAtColumn = tableAsRecord.deletedAt

    if (!deletedAtColumn) {
      throw new Error(
        `Table "${String(this.tableName)}" does not have deletedAt field`,
      )
    }

    const result = await this.db
      .select()
      .from(tableInstance as PgTable<TableConfig>)
      .where(and(where, isNull(deletedAtColumn)))
      .limit(1)

    return result.length > 0
  }
}
