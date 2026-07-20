import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { relations } from './drizzle-relations'
import type { PostgresErrorFacts } from './error/postgres-error'

/** 稳定领域类型 `Db`。仅供内部领域/服务链路复用，避免重复定义。 */
export type Db = NodePgDatabase<typeof relations>

/**
 * Drizzle `transaction()` 回调实际提供的客户端。
 *
 * 必须从根客户端的真实回调签名推导，避免把根 `Db` 误标为事务客户端，进而让
 * 事务边界在类型层失真。
 */
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Drizzle node-postgres 事务配置，原样透传给 `db.transaction()`。 */
export type DbTransactionConfig = NonNullable<Parameters<Db['transaction']>[1]>

/**
 * 可执行查询的数据库句柄：要么是根客户端，要么是实际事务客户端。
 *
 * 仅当调用方允许两种上下文时使用；事务 callback 和必须处于同一事务的 API 应使用
 * `DbTransaction`，不能再以 root `Db` 伪装。
 */
export type DbExecutor = Db | DbTransaction

/** Seed 脚本使用的数据库客户端类型。 */
export type SeedDb = Db

export type { PgTable }

export type { SQL, SQLWrapper, TableConfig }

/** 稳定领域类型 `DrizzleErrorMessages`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface DrizzleErrorMessages {
  duplicate?: string
  notNull?: string
  foreignKey?: string
  check?: string
  conflict?: string
  serviceUnavailable?: string
  notFound?: string
}

export interface DrizzleTransactionRetryOptions {
  safeToRetry: true
  maxAttempts: number
  retryDeadlock?: boolean
  baseDelayMs?: number
  maxDelayMs?: number
  jitterRatio?: number
}

/**
 * 唯一的事务服务调用契约。
 *
 * `messages` 与 Drizzle 原生事务 `config` 都属于同一个 options object，避免
 * 位置参数在后续扩展时产生歧义。
 */
export interface DrizzleTransactionOptions<T> {
  execute: (tx: DbTransaction) => Promise<T>
  config?: DbTransactionConfig
  messages?: DrizzleErrorMessages
  retry?: DrizzleTransactionRetryOptions
}

/** 稳定领域类型 `DrizzleMutationResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export type DrizzleMutationResult = { rowCount?: number | null } | unknown[]

export interface DatabaseErrorDiagnostic {
  errorName: string
  facts: PostgresErrorFacts | null
  stackFrames: string[]
}
