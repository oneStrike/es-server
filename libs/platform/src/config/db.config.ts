import type {
  DbConfigInterface,
  DbPoolConfig,
  DbQueryConfig,
} from './db.type'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

export type {
  DbConfigInterface,
  DbPoolConfig,
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
  }
}

export const DbConfigRegister = registerAs('db', (): DbConfigInterface => ({
  // 数据库连接配置
  connection: process.env.DATABASE_URL,
  pool: resolveDbPoolConfig({
    max: Number(process.env.DB_POOL_MAX),
  }),
  query: resolveDbQueryConfig(),
}))

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  return fallback
}
