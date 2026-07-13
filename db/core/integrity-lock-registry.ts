import type { SQLWrapper } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/**
 * 稳定的 64-bit advisory-lock hash seed。
 *
 * 不可按调用方、部署或环境随机化；相同的 namespace/owner tuple 必须在所有进程中
 * 解析为同一个 PostgreSQL transaction-level advisory lock。
 */
const INTEGRITY_LOCK_HASH_SEED = 274900821

export const IntegrityLockNamespace = {
  JOB: 'job',
  RECORD: 'record',
  RELATION: 'relation',
} as const

export type IntegrityLockNamespaceValue =
  (typeof IntegrityLockNamespace)[keyof typeof IntegrityLockNamespace]

export type IntegrityLockOwnerPart = bigint | boolean | number | string | null

export interface IntegrityLock {
  canonicalOwnerKey: string
  namespace: IntegrityLockNamespaceValue
}

/**
 * Advisory locks only require an executable transaction handle. Keeping this
 * structural avoids coupling maintenance scripts (which intentionally use a
 * schema-light Drizzle client) to the application relation generic.
 */
export interface IntegrityLockExecutor {
  execute: (query: SQLWrapper) => unknown
}

/**
 * 用于脚本中已显式打开事务的 node-postgres client。业务写路径必须优先使用
 * `acquireIntegrityLocks`；此接口只避免维护脚本重写锁的哈希与排序协议。
 */
export interface IntegrityLockQueryExecutor {
  query: (statement: string, values: unknown[]) => Promise<unknown>
}

/**
 * 为单表实体构造唯一的完整性锁。父删除与子写入必须使用同一 tableName/id tuple，
 * 而不是各自在业务文件中发明常量或直接调用 pg_advisory_xact_lock。
 */
export function tableIntegrityLock(
  tableName: string,
  id: IntegrityLockOwnerPart,
): IntegrityLock {
  return integrityLock(IntegrityLockNamespace.RECORD, tableName, id)
}

/**
 * 为关系或多字段 owner 构造稳定锁。传入顺序本身是关系 contract 的一部分。
 */
export function relationIntegrityLock(
  relationName: string,
  ...ownerParts: IntegrityLockOwnerPart[]
): IntegrityLock {
  return integrityLock(
    IntegrityLockNamespace.RELATION,
    relationName,
    ...ownerParts,
  )
}

/**
 * RBAC 写入与 reference bootstrap 共享的关系锁 owner。
 *
 * 这两个资源必须始终从此处引用，避免 bootstrap 和应用写路径各自重建
 * advisory-lock owner 而发生漂移。
 */
export const ADMIN_RBAC_RELATION_INTEGRITY_LOCKS = {
  mutation: relationIntegrityLock('admin-rbac-mutation', 'global'),
  superAdminMembership: relationIntegrityLock(
    'admin-rbac-super-admin-membership',
    'global',
  ),
} as const

/** 为离线 repair/seed 等单一作业构造互斥锁。 */
export function jobIntegrityLock(jobName: string): IntegrityLock {
  return integrityLock(IntegrityLockNamespace.JOB, jobName)
}

/**
 * 对所有锁按 `(namespace, canonicalOwnerKey)` 去重排序后取得 transaction-level
 * advisory locks。排序是死锁避免协议的一部分，调用方不得自行循环加锁。
 */
export async function acquireIntegrityLocks(
  tx: IntegrityLockExecutor,
  locks: readonly IntegrityLock[],
): Promise<void> {
  for (const lock of normalizeIntegrityLocks(locks)) {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${buildIntegrityLockHashInput(lock)},
          ${INTEGRITY_LOCK_HASH_SEED}::bigint
        )
      )
    `)
  }
}

/**
 * 为 node-postgres 事务复用完全相同的锁资源、哈希和顺序协议。
 */
export async function acquireIntegrityLocksWithQueryExecutor(
  client: IntegrityLockQueryExecutor,
  locks: readonly IntegrityLock[],
): Promise<void> {
  for (const lock of normalizeIntegrityLocks(locks)) {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text, $2::bigint))',
      [buildIntegrityLockHashInput(lock), INTEGRITY_LOCK_HASH_SEED],
    )
  }
}

/**
 * 由独立的 autocommit observer 探测一个 registry lock 是否正被其他事务持有。
 *
 * 此函数只服务于运维验证：observer 必须是会为本次 query 使用独立隐式事务的
 * executor（例如 `pg.Pool.query`），不能传入已经显式开启事务的 client。锁空闲时，
 * `pg_try_advisory_xact_lock` 会在该隐式事务内短暂取得锁并在 statement 结束后释放；
 * 锁被占用时则返回 `true`，从而不向调用方泄露 registry 的 hash/serialization 细节。
 */
export async function isIntegrityLockHeldByAnotherTransaction(
  observer: IntegrityLockQueryExecutor,
  lock: IntegrityLock,
): Promise<boolean> {
  const result = await observer.query(
    'SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, $2::bigint)) AS acquired',
    [buildIntegrityLockHashInput(lock), INTEGRITY_LOCK_HASH_SEED],
  )
  const acquired = readIntegrityLockProbeAcquired(result)
  return !acquired
}

export function integrityLock(
  namespace: IntegrityLockNamespaceValue,
  ...ownerParts: IntegrityLockOwnerPart[]
): IntegrityLock {
  if (namespace.length === 0) {
    throw new TypeError('Integrity lock namespace must not be empty')
  }
  if (ownerParts.length === 0) {
    throw new TypeError('Integrity lock owner must not be empty')
  }

  return {
    canonicalOwnerKey: JSON.stringify(ownerParts.map(canonicalizeOwnerPart)),
    namespace,
  }
}

function canonicalizeOwnerPart(value: IntegrityLockOwnerPart): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'boolean') {
    return value ? 'boolean:true' : 'boolean:false'
  }
  if (typeof value === 'bigint') {
    return `bigint:${value.toString()}`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Integrity lock numeric owner must be finite')
    }
    return `number:${value}`
  }
  return `string:${value}`
}

function normalizeIntegrityLocks(
  locks: readonly IntegrityLock[],
): IntegrityLock[] {
  const unique = new Map<string, IntegrityLock>()
  for (const lock of locks) {
    unique.set(buildIntegrityLockHashInput(lock), lock)
  }

  return [...unique.values()].sort(
    (left, right) =>
      left.namespace.localeCompare(right.namespace) ||
      left.canonicalOwnerKey.localeCompare(right.canonicalOwnerKey),
  )
}

function buildIntegrityLockHashInput(lock: IntegrityLock): string {
  // PostgreSQL text values cannot contain NUL bytes. A canonical JSON tuple is
  // both unambiguous for all owner strings and valid for every text binding
  // path used by Drizzle and node-postgres.
  return JSON.stringify([lock.namespace, lock.canonicalOwnerKey])
}

function readIntegrityLockProbeAcquired(result: unknown): boolean {
  if (!isRecord(result) || !isUnknownArray(result.rows)) {
    throw new TypeError('Integrity lock observer returned no query rows')
  }

  const row = result.rows[0]
  if (!isRecord(row) || typeof row.acquired !== 'boolean') {
    throw new TypeError(
      'Integrity lock observer returned an invalid acquired flag',
    )
  }

  return row.acquired
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}
