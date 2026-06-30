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
}

/**
 * 数据库模块完整配置。
 */
export interface DbConfigInterface {
  connection?: string
  pool: DbPoolConfig
  query: DbQueryConfig
}
