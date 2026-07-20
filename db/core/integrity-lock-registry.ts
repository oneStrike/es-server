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
  readonly canonicalOwnerKey: string
  readonly namespace: IntegrityLockNamespaceValue
}

export type IntegrityLockMode = 'exclusive' | 'shared'

export interface IntegrityLockRequest {
  readonly mode: IntegrityLockMode
  readonly resource: IntegrityLock
}

/**
 * advisory lock 只需要可执行事务句柄。保持结构化以避免维护脚本（故意使用 schema-light Drizzle client）
 * 与应用 relation 泛型耦合。
 */
export interface IntegrityLockExecutor {
  execute: (query: SQLWrapper) => unknown
}

/** 只读运维探针使用独立 autocommit 连接，不参与业务锁获取。 */
export interface IntegrityLockObserver {
  query: (statement: string, values: unknown[]) => Promise<unknown>
}

/**
 * 为共享模式构造完整性锁请求。
 */
export function sharedIntegrityLock(
  resource: IntegrityLock,
): IntegrityLockRequest {
  return { mode: 'shared', resource }
}

/**
 * 为独占模式构造完整性锁请求。
 */
export function exclusiveIntegrityLock(
  resource: IntegrityLock,
): IntegrityLockRequest {
  return { mode: 'exclusive', resource }
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
 * 先按完整 canonical resource 归并最强模式，再按
 * `(namespace, canonicalOwnerKey)` 排序并逐锁获取 transaction-level advisory
 * lock。完整归一化发生在首条 SQL 之前，避免持锁后升级。
 */
export async function acquireIntegrityLocks(
  tx: IntegrityLockExecutor,
  requests: readonly IntegrityLockRequest[],
): Promise<void> {
  for (const request of normalizeIntegrityLockRequests(requests)) {
    const hashInput = buildIntegrityLockHashInput(request.resource)
    if (request.mode === 'shared') {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock_shared(
          hashtextextended(
            ${hashInput},
            ${INTEGRITY_LOCK_HASH_SEED}::bigint
          )
        )
      `)
      continue
    }
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${hashInput},
          ${INTEGRITY_LOCK_HASH_SEED}::bigint
        )
      )
    `)
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
  observer: IntegrityLockObserver,
  lock: IntegrityLock,
): Promise<boolean> {
  const result = await observer.query(
    'SELECT pg_try_advisory_xact_lock(hashtextextended($1::text, $2::bigint)) AS acquired',
    [buildIntegrityLockHashInput(lock), INTEGRITY_LOCK_HASH_SEED],
  )
  const acquired = readIntegrityLockProbeAcquired(result)
  return !acquired
}

/**
 * 构造唯一的完整性锁；校验 namespace 和 ownerParts 非空，并生成规范化的 canonicalOwnerKey。
 */
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

// 将 ownerPart 规范化为类型前缀字符串，确保不同类型值不会碰撞。
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

// 归并同一资源的最强模式，再按 (namespace, canonicalOwnerKey) 排序后输出有序锁请求列表。
function normalizeIntegrityLockRequests(
  requests: readonly IntegrityLockRequest[],
): IntegrityLockRequest[] {
  const strongestByResource = new Map<string, IntegrityLockRequest>()
  for (const request of requests) {
    assertIntegrityLockRequest(request)
    const resourceKey = buildIntegrityLockHashInput(request.resource)
    const current = strongestByResource.get(resourceKey)
    if (!current || request.mode === 'exclusive') {
      strongestByResource.set(resourceKey, request)
    }
  }

  return [...strongestByResource.values()].sort(
    (left, right) =>
      left.resource.namespace.localeCompare(right.resource.namespace) ||
      left.resource.canonicalOwnerKey.localeCompare(
        right.resource.canonicalOwnerKey,
      ),
  )
}

// 运行时校验锁请求的结构完整性。
function assertIntegrityLockRequest(
  request: IntegrityLockRequest,
): asserts request is IntegrityLockRequest {
  if (!isRecord(request)) {
    throw new TypeError('Integrity lock request must be an object')
  }
  if (request.mode !== 'shared' && request.mode !== 'exclusive') {
    throw new TypeError(
      'Integrity lock request mode must be shared or exclusive',
    )
  }
  if (!isRecord(request.resource)) {
    throw new TypeError('Integrity lock request resource must be an object')
  }
  if (
    !Object.values(IntegrityLockNamespace).includes(
      request.resource.namespace,
    ) ||
    typeof request.resource.canonicalOwnerKey !== 'string'
  ) {
    throw new TypeError('Integrity lock request resource is invalid')
  }
}

// 构造用于 hashtextextended 的输入文本；使用 JSON 元组保证无歧义且不含 NUL 字节。
function buildIntegrityLockHashInput(lock: IntegrityLock): string {
  // PostgreSQL text 值不能包含 NUL 字节；JSON 元组对所有 owner 字符串无歧义，
  // 且在 Drizzle 和 node-postgres 的所有 text binding 路径中合法。
  return JSON.stringify([lock.namespace, lock.canonicalOwnerKey])
}

// 从 observer 查询结果中安全读取 acquired 标志。
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

// 类型守卫：判断值是否为非 null 对象。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// 类型守卫：判断值是否为数组。
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}
