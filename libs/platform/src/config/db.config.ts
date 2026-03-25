import process from 'node:process'
import { registerAs } from '@nestjs/config'

export type DbQueryOrderByRecord = Record<string, 'asc' | 'desc'>

export type DbQueryOrderBy =
  | DbQueryOrderByRecord
  | DbQueryOrderByRecord[]

export interface DbQueryConfig {
  pageSize: number
  pageIndex: number
  maxListItemLimit: number
  orderBy: DbQueryOrderBy
}

export interface DbConfigInterface {
  connection?: string
  query: DbQueryConfig
}

export const DEFAULT_DB_QUERY_CONFIG: DbQueryConfig = {
  pageSize: 15,
  pageIndex: 1,
  maxListItemLimit: 500,
  orderBy: {
    id: 'desc',
  },
}

export const DbConfig: DbConfigInterface = {
  // 数据库连接配置
  connection: process.env.DATABASE_URL,
  query: DEFAULT_DB_QUERY_CONFIG,
}

export const DbConfigRegister = registerAs(
  'db',
  (): DbConfigInterface => DbConfig,
)
