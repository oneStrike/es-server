import type {
  DbConfigInterface,
  DbConnectionBudgetConfig,
  DbConnectionBudgetProcessConfig,
  DbPoolConfig,
  DbProcessRole,
  DbQueryConfig,
} from './db.type'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

export type {
  DbConfigInterface,
  DbConnectionBudgetConfig,
  DbConnectionBudgetProcessConfig,
  DbPoolConfig,
  DbProcessRole,
  DbQueryConfig,
  DbQueryOrderBy,
  DbQueryOrderByRecord,
} from './db.type'

export function resolveDbQueryConfig(
  queryConfig?: Partial<DbQueryConfig>,
): DbQueryConfig {
  return {
    pageSize: queryConfig?.pageSize ?? 15,
    pageIndex: queryConfig?.pageIndex ?? 1,
    maxListItemLimit: queryConfig?.maxListItemLimit ?? 500,
  }
}

export function resolveDbPoolConfig(
  poolConfig?: Partial<DbPoolConfig>,
): DbPoolConfig {
  return {
    max: resolvePositiveInteger(poolConfig?.max, 20),
    connectionTimeoutMillis: resolvePositiveInteger(
      poolConfig?.connectionTimeoutMillis,
      5_000,
    ),
    idleTimeoutMillis: resolvePositiveInteger(
      poolConfig?.idleTimeoutMillis,
      30_000,
    ),
    maxLifetimeSeconds: resolvePositiveInteger(
      poolConfig?.maxLifetimeSeconds,
      1_800,
    ),
  }
}

export function resolveDbConnectionBudgetConfig(
  connectionBudget?: Partial<DbConnectionBudgetConfig>,
): DbConnectionBudgetConfig {
  const processes = connectionBudget?.processes
  const budget: DbConnectionBudgetConfig = {
    maxConnections: resolvePositiveInteger(
      connectionBudget?.maxConnections,
      100,
    ),
    processes: {
      'admin-api': resolveDbConnectionBudgetProcessConfig(
        processes?.['admin-api'],
        0,
      ),
      'app-api': resolveDbConnectionBudgetProcessConfig(
        processes?.['app-api'],
        1,
      ),
    },
    concurrentMigrators: resolveNonNegativeInteger(
      connectionBudget?.concurrentMigrators,
      1,
    ),
    opsHeadroom: resolveNonNegativeInteger(connectionBudget?.opsHeadroom, 5),
    superuserReserve: resolveNonNegativeInteger(
      connectionBudget?.superuserReserve,
      3,
    ),
  }

  assertDbConnectionBudget(budget)
  return budget
}

/** 返回唯一的全局 PostgreSQL 连接预算公式结果。 */
export function calculateDbConnectionBudget(
  connectionBudget: DbConnectionBudgetConfig,
): number {
  const processConnections = Object.values(connectionBudget.processes).reduce(
    (total, processConfig) =>
      total +
      processConfig.replicas *
      (processConfig.queryPoolMax + processConfig.listenerConnections),
    0,
  )

  return (
    processConnections +
    connectionBudget.concurrentMigrators +
    connectionBudget.opsHeadroom +
    connectionBudget.superuserReserve
  )
}

export function assertDbConnectionBudget(
  connectionBudget: DbConnectionBudgetConfig,
): void {
  const requiredConnections = calculateDbConnectionBudget(connectionBudget)
  if (requiredConnections > connectionBudget.maxConnections) {
    throw new Error(
      `PostgreSQL connection budget exceeded: required=${requiredConnections}, max_connections=${connectionBudget.maxConnections}`,
    )
  }
}

export const DbConfigRegister = registerAs('db', (): DbConfigInterface => {
  const processRole = resolveDbProcessRole(
    process.env.DB_PROCESS_ROLE ?? process.env.APP_NAME,
  )
  const connectionBudget = resolveDbConnectionBudgetConfig({
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS),
    processes: {
      'admin-api': {
        replicas: Number(process.env.DB_ADMIN_API_REPLICAS),
        queryPoolMax: Number(process.env.DB_ADMIN_API_POOL_MAX),
        listenerConnections: Number(
          process.env.DB_ADMIN_API_LISTENER_CONNECTIONS,
        ) as 0 | 1,
      },
      'app-api': {
        replicas: Number(process.env.DB_APP_API_REPLICAS),
        queryPoolMax: Number(process.env.DB_APP_API_POOL_MAX),
        listenerConnections: Number(
          process.env.DB_APP_API_LISTENER_CONNECTIONS,
        ) as 0 | 1,
      },
    },
    concurrentMigrators: Number(process.env.DB_CONCURRENT_MIGRATORS),
    opsHeadroom: Number(process.env.DB_OPS_HEADROOM),
    superuserReserve: Number(process.env.DB_SUPERUSER_RESERVE),
  })
  const processBudget = connectionBudget.processes[processRole]

  return {
    connection: process.env.DATABASE_URL,
    processRole,
    pool: resolveDbPoolConfig({
      max: processBudget.queryPoolMax,
      connectionTimeoutMillis: Number(
        process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
      ),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS),
      maxLifetimeSeconds: Number(process.env.DB_POOL_MAX_LIFETIME_SECONDS),
    }),
    connectionBudget,
    query: resolveDbQueryConfig(),
  }
})

export function resolveDbProcessRole(value: unknown): DbProcessRole {
  if (value === 'admin-api' || value === 'app-api') {
    return value
  }

  throw new Error(
    'DB_PROCESS_ROLE must be "admin-api" or "app-api" (or APP_NAME must match one of them)',
  )
}

function resolveDbConnectionBudgetProcessConfig(
  processConfig: Partial<DbConnectionBudgetProcessConfig> | undefined,
  defaultListenerConnections: 0 | 1,
): DbConnectionBudgetProcessConfig {
  return {
    replicas: resolveNonNegativeInteger(processConfig?.replicas, 1),
    queryPoolMax: resolvePositiveInteger(processConfig?.queryPoolMax, 20),
    listenerConnections: resolveListenerConnections(
      processConfig?.listenerConnections,
      defaultListenerConnections,
    ),
  }
}

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  return fallback
}

function resolveNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  return fallback
}

function resolveListenerConnections(
  value: number | undefined,
  fallback: 0 | 1,
): 0 | 1 {
  if (value === 0 || value === 1) {
    return value
  }

  return fallback
}
