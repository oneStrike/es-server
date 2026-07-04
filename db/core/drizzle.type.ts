import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from './drizzle-relations'

/** 稳定领域类型 `Db`。仅供内部领域/服务链路复用，避免重复定义。 */
export type Db = NodePgDatabase<typeof relations>

/** Seed 脚本使用的数据库客户端类型。 */
export type SeedDb = Db

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
