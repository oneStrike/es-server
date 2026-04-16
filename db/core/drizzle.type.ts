import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from '../relations'
import type * as schema from '../schema'

/** 稳定领域类型 `Db`。仅供内部领域/服务链路复用，避免重复定义。 */
export type Db = NodePgDatabase<typeof schema, typeof relations>

export type { PgTable }

export type { SQL, SQLWrapper, TableConfig }

/** 稳定领域类型 `DrizzleErrorMessages`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface DrizzleErrorMessages {
  duplicate?: string
  notNull?: string
  check?: string
  conflict?: string
  notFound?: string
}

/** 稳定领域类型 `DrizzleMutationResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export type DrizzleMutationResult = { rowCount?: number | null } | unknown[]
