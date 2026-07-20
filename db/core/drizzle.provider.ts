import type { DbConfigInterface } from '@libs/platform/config'
import type { Provider } from '@nestjs/common'
import type { Db } from './drizzle.type'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './drizzle-relations'
import { buildSafeDatabaseDiagnostic } from './error/error-handler'

// 内部原始 pg Pool token，不暴露在 @db/core 的 public barrel 中；
// 仅供 LISTEN/NOTIFY 或生命周期管理等 driver 级特性注入使用。
export const DRIZZLE_POOL = 'DRIZZLE_POOL'
export const DRIZZLE_DB = 'DRIZZLE_DB'
// 内部运行时配置 token，不暴露在 @db/core 的 public barrel 中。
export const DRIZZLE_RUNTIME_CONFIG = 'DRIZZLE_RUNTIME_CONFIG'

/** 数据库连接池运行时配置。 */
interface DrizzleRuntimeConfig {
  connectionString: string
  poolMax: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
  maxLifetimeSeconds: number
  listenerConnections: 0 | 1
}

/** 从 ConfigService 解析数据库连接池运行时配置的 Provider。 */
export const DrizzleRuntimeConfigProvider: Provider = {
  provide: DRIZZLE_RUNTIME_CONFIG,
  useFactory: (configService: ConfigService): DrizzleRuntimeConfig => {
    const dbConfig = configService.get<DbConfigInterface>('db')
    const connectionString =
      dbConfig?.connection ??
      configService.get<string>('DATABASE_URL') ??
      process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }

    if (!dbConfig) {
      throw new Error('Missing resolved db configuration')
    }

    const processBudget =
      dbConfig.connectionBudget.processes[dbConfig.processRole]

    return {
      connectionString,
      poolMax: dbConfig.pool.max,
      connectionTimeoutMillis: dbConfig.pool.connectionTimeoutMillis,
      idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
      maxLifetimeSeconds: dbConfig.pool.maxLifetimeSeconds,
      listenerConnections: processBudget.listenerConnections,
    }
  },
  inject: [ConfigService],
}

/** 从运行时配置创建 pg.Pool 的 Provider。 */
export const DrizzlePoolProvider: Provider = {
  provide: DRIZZLE_POOL,
  useFactory: (runtimeConfig: DrizzleRuntimeConfig): Pool => {
    const pool = new Pool({
      connectionString: runtimeConfig.connectionString,
      max: runtimeConfig.poolMax,
      connectionTimeoutMillis: runtimeConfig.connectionTimeoutMillis,
      idleTimeoutMillis: runtimeConfig.idleTimeoutMillis,
      maxLifetimeSeconds: runtimeConfig.maxLifetimeSeconds,
    })

    const logger = new Logger('DrizzlePool')
    pool.on('error', (error) => {
      logger.error('Unexpected idle PostgreSQL pool client error', {
        database: buildSafeDatabaseDiagnostic(error, {
          source: 'postgres-pool',
        }),
      })
    })

    return pool
  },
  inject: [DRIZZLE_RUNTIME_CONFIG],
}

/** 从 pg.Pool 创建 Drizzle 实例的 Provider。 */
export const DrizzleDbProvider: Provider = {
  provide: DRIZZLE_DB,
  useFactory: (pool: Pool): Db =>
    drizzle({
      client: pool,
      relations,
      jit: true,
    }),
  inject: [DRIZZLE_POOL],
}
