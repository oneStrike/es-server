import type { Provider } from '@nestjs/common'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import process from 'node:process'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './relations'
import * as schema from './schema'

/** Drizzle 数据库类型定义 */
export type Db = NodePgDatabase<typeof schema, typeof relations>

/** 数据库连接池注入令牌 */
export const DRIZZLE_POOL = 'DRIZZLE_POOL'
/** Drizzle 数据库实例注入令牌 */
export const DRIZZLE_DB = 'DRIZZLE_DB'
/** Drizzle 数据库实例注入令牌（旧版兼容） */
export const DRIZZLE_DB_LEGACY = 'DrizzleDb'
/** PostgreSQL 连接注入令牌（别名） */
export const PG_CONNECTION = DRIZZLE_DB

/**
 * Drizzle 数据库连接池 Provider
 * 基于配置服务创建 PostgreSQL 连接池
 */
export const DrizzlePoolProvider: Provider = {
  provide: DRIZZLE_POOL,
  useFactory: (configService: ConfigService): Pool => {
    const connectionString = configService.get<string>('db.connection')
    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }
    return new Pool({ connectionString })
  },
  inject: [ConfigService],
}

/**
 * Drizzle 数据库实例 Provider
 * 基于连接池创建 Drizzle ORM 实例
 */
export const DrizzleDbProvider: Provider = {
  provide: DRIZZLE_DB,
  useFactory: (pool: Pool): Db =>
    drizzle({
      client: pool,
      schema,
      relations,
      casing: 'snake_case',
      logger: process.env.NODE_ENV === 'development',
    }),
  inject: [DRIZZLE_POOL],
}

/**
 * Drizzle 数据库实例 Provider（旧版兼容）
 * 使用 useExisting 指向新的 DRIZZLE_DB 令牌
 */
export const DrizzleDbLegacyProvider: Provider = {
  provide: DRIZZLE_DB_LEGACY,
  useExisting: DRIZZLE_DB,
}
