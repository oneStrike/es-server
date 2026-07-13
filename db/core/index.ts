export { DbNotificationService } from './db-notification.service'
export type {
  DbNotificationMetrics,
  DbNotificationSubscription,
  DbNotificationSubscriptionOptions,
} from './db-notification.type'
export { relations } from './drizzle-relations'
export { DrizzleModule } from './drizzle.module'
export { DrizzleService } from './drizzle.service'
export type {
  Db,
  DbExecutor,
  DbTransaction,
  DbTransactionConfig,
  DrizzleErrorMessages,
  DrizzleMutationResult,
  DrizzleTransactionOptions,
  PgTable,
  SeedDb,
  SQL,
  TableConfig,
} from './drizzle.type'
export { extractError } from './error/error-handler'
export { getPostgresErrorResponseDescriptor } from './error/postgres-error'
export {
  acquireIntegrityLocks,
  acquireIntegrityLocksWithQueryExecutor,
  ADMIN_RBAC_RELATION_INTEGRITY_LOCKS,
  integrityLock,
  IntegrityLockNamespace,
  isIntegrityLockHeldByAnotherTransaction,
  jobIntegrityLock,
  relationIntegrityLock,
  tableIntegrityLock,
} from './integrity-lock-registry'
export type {
  IntegrityLock,
  IntegrityLockExecutor,
  IntegrityLockNamespaceValue,
  IntegrityLockOwnerPart,
  IntegrityLockQueryExecutor,
} from './integrity-lock-registry'
export { buildILikeCondition, buildLikePattern } from './query/like-pattern'
export { toPageResult } from './query/page-result'
export { extractRows } from './query/raw-result.helper'
