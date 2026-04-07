import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from '../relations'
import type * as schema from '../schema'

export type Db = NodePgDatabase<typeof schema, typeof relations>

export type { PgTable }

export type { SQL, SQLWrapper, TableConfig }

export interface DrizzleErrorMessages {
  duplicate?: string
  notNull?: string
  check?: string
  conflict?: string
  notFound?: string
}

export type DrizzleMutationResult = { rowCount?: number | null } | unknown[]
