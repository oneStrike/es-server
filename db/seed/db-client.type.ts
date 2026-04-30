import type { Db as CoreDb } from '../core/drizzle.type'
import type * as operators from 'drizzle-orm'

/**
 * Seed relational query 的最小查询配置。
 */
export interface SeedQueryConfig {
  where?: object | ((table: object, ops: typeof operators) => object)
}

/**
 * Seed 脚本使用的轻量表查询代理。
 */
export interface SeedTableQuery {
  findFirst?: (config?: SeedQueryConfig) => Promise<object | undefined>
  findMany?: (config?: SeedQueryConfig) => Promise<object[]>
}

/**
 * Seed 脚本的数据库客户端类型，补齐动态 query 代理。
 */
export type Db = Omit<CoreDb, 'query'> & {
  query: Record<string, SeedTableQuery>
}
