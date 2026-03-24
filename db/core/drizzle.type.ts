import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from '../relations'
import type * as schema from '../schema'

export type Db = NodePgDatabase<typeof schema, typeof relations>

export type DrizzleSql = SQL

export type { PgTable }

export type { SQL, SQLWrapper, TableConfig }

export type DrizzleWhere = SQL | undefined

export interface DrizzleErrorMessages {
  duplicate?: string
  notNull?: string
  check?: string
  conflict?: string
}

export type DrizzleColumnKey<TTable extends PgTable> =
  keyof TTable['_']['columns'] & string

export type DrizzleWhereBinaryOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'

export interface DrizzleWhereBinaryCondition<TTable extends PgTable> {
  field: DrizzleColumnKey<TTable>
  op: DrizzleWhereBinaryOperator
  value: unknown
}

export interface DrizzleWhereBetweenCondition<TTable extends PgTable> {
  field: DrizzleColumnKey<TTable>
  op: 'between'
  value: {
    from?: unknown
    to?: unknown
  }
}

export interface DrizzleWhereNullCondition<TTable extends PgTable> {
  field: DrizzleColumnKey<TTable>
  op: 'isNull' | 'isNotNull'
}

export interface DrizzleWhereFieldFilter {
  eq?: unknown
  ne?: unknown
  gt?: unknown
  gte?: unknown
  lt?: unknown
  lte?: unknown
  like?: unknown
  startsWith?: unknown
  endsWith?: unknown
  in?: unknown
  notIn?: unknown
  between?: {
    from?: unknown
    to?: unknown
  }
  isNull?: boolean
  isNotNull?: boolean
}

export type DrizzleWhereFieldValue = unknown | DrizzleWhereFieldFilter

export type DrizzleWhereObjectNode<TTable extends PgTable> = Partial<
  Record<DrizzleColumnKey<TTable>, DrizzleWhereFieldValue>
>

export type DrizzleWhereCondition<TTable extends PgTable> =
  | DrizzleWhereBinaryCondition<TTable>
  | DrizzleWhereBetweenCondition<TTable>
  | DrizzleWhereNullCondition<TTable>

export interface DrizzleWhereAndNode<TTable extends PgTable> {
  and: DrizzleWhereNode<TTable>[] | DrizzleWhereObjectNode<TTable>
}

export interface DrizzleWhereOrNode<TTable extends PgTable> {
  or: DrizzleWhereNode<TTable>[] | DrizzleWhereObjectNode<TTable>
}

export interface DrizzleWhereNotNode<TTable extends PgTable> {
  not: DrizzleWhereNode<TTable>
}

export type DrizzleWhereNode<TTable extends PgTable> =
  | DrizzleWhereCondition<TTable>
  | DrizzleWhereAndNode<TTable>
  | DrizzleWhereOrNode<TTable>
  | DrizzleWhereNotNode<TTable>
