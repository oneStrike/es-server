/**
 * 数据库查询排序字段与方向映射。
 */
export type DbQueryOrderByRecord = Record<string, 'asc' | 'desc'>

/**
 * 数据库查询排序配置。
 */
export type DbQueryOrderBy = DbQueryOrderByRecord | DbQueryOrderByRecord[]

/**
 * 数据库分页查询默认配置。
 */
export interface DbQueryConfig {
  pageSize: number
  pageIndex: number
  maxListItemLimit: number
}

/**
 * 数据库连接池配置。
 */
export interface DbPoolConfig {
  max: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
  maxLifetimeSeconds: number
}

/** 可部署的数据库进程类别。 */
export type DbProcessRole = 'admin-api' | 'app-api'

/** 单个进程类别在连接预算中的固定占用上限。 */
export interface DbConnectionBudgetProcessConfig {
  replicas: number
  queryPoolMax: number
  listenerConnections: 0 | 1
}

/**
 * PostgreSQL 全局连接预算。
 *
 * 预算只允许由显式的进程类别、副本数与连接类型组成，避免部署时以经验值猜测
 * `max_connections` 是否足够。
 */
export interface DbConnectionBudgetConfig {
  maxConnections: number
  processes: Record<DbProcessRole, DbConnectionBudgetProcessConfig>
  concurrentMigrators: number
  opsHeadroom: number
  superuserReserve: number
}

/**
 * 数据库模块完整配置。
 */
export interface DbConfigInterface {
  connection?: string
  processRole: DbProcessRole
  pool: DbPoolConfig
  connectionBudget: DbConnectionBudgetConfig
  query: DbQueryConfig
}
