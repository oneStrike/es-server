import process from 'node:process'
import { registerAs } from '@nestjs/config'

export type DbQueryOrderByRecord = Record<string, 'asc' | 'desc'>

export type DbQueryOrderBy = DbQueryOrderByRecord | DbQueryOrderByRecord[]

export interface DbQueryConfig {
  pageSize: number
  pageIndex: number
  maxListItemLimit: number
}

export interface DbConfigInterface {
  connection?: string
  query: DbQueryConfig
}

export function resolveDbQueryConfig(
  queryConfig?: Partial<DbQueryConfig>,
): DbQueryConfig {
  return {
    pageSize: queryConfig?.pageSize ?? 15,
    pageIndex: queryConfig?.pageIndex ?? 1,
    maxListItemLimit: queryConfig?.maxListItemLimit ?? 500,
  }
}

export const DbConfig: DbConfigInterface = {
  // 数据库连接配置
  connection: process.env.DATABASE_URL,
  query: resolveDbQueryConfig(),
}

export const DbConfigRegister = registerAs(
  'db',
  (): DbConfigInterface => DbConfig,
)
