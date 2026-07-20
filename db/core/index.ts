export { DbNotificationService } from './db-notification.service'
export type {
  DbNotificationMetrics,
  DbNotificationSubscription,
  DbNotificationSubscriptionOptions,
} from './db-notification.type'
export { DrizzleModule } from './drizzle.module'
export { DrizzleService } from './drizzle.service'
export type {
  DatabaseErrorDiagnostic,
  Db,
  DbExecutor,
  DbTransaction,
  DbTransactionConfig,
  DrizzleErrorMessages,
  DrizzleMutationResult,
  DrizzleTransactionOptions,
  DrizzleTransactionRetryOptions,
  PgTable,
  SeedDb,
  SQL,
  TableConfig,
} from './drizzle.type'
export { buildSafeDatabaseDiagnostic } from './error/error-handler'
export {
  classifyPostgresError,
  getPostgresErrorResponseDescriptor,
  isRetryablePostgresError,
  PostgresErrorCode,
} from './error/postgres-error'
export type {
  PostgresErrorCategory,
  PostgresErrorCodeValue,
  PostgresErrorFacts,
  PostgresErrorMessageKey,
  PostgresErrorResponseDescriptor,
  PostgresErrorSource,
} from './error/postgres-error'
export {
  acquireIntegrityLocks,
  ADMIN_RBAC_RELATION_INTEGRITY_LOCKS,
  exclusiveIntegrityLock,
  integrityLock,
  IntegrityLockNamespace,
  isIntegrityLockHeldByAnotherTransaction,
  jobIntegrityLock,
  relationIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
} from './integrity-lock-registry'
export type {
  IntegrityLock,
  IntegrityLockExecutor,
  IntegrityLockMode,
  IntegrityLockNamespaceValue,
  IntegrityLockObserver,
  IntegrityLockOwnerPart,
  IntegrityLockRequest,
} from './integrity-lock-registry'
export { buildILikeCondition, buildLikePattern } from './query/like-pattern'
export { toPageResult } from './query/page-result'
export type { PageResult } from './query/page-result'
export { extractRows } from './query/raw-result.helper'
