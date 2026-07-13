import type { DbConfigInterface } from '@libs/platform/config'
import type { Provider } from '@nestjs/common'
import type { Db } from './drizzle.type'
import process from 'node:process'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './drizzle-relations'

// Internal raw pg Pool token. Keep it out of @db/core's public barrel; inject it
// only for driver-level features such as LISTEN/NOTIFY or lifecycle management.
export const DRIZZLE_POOL = 'DRIZZLE_POOL'
export const DRIZZLE_DB = 'DRIZZLE_DB'
// Internal runtime wiring only. It intentionally remains outside @db/core's public barrel.
export const DRIZZLE_RUNTIME_CONFIG = 'DRIZZLE_RUNTIME_CONFIG'

interface DrizzleRuntimeConfig {
  connectionString: string
  poolMax: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
  maxLifetimeSeconds: number
  listenerConnections: 0 | 1
}

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
      logger.error('Unexpected idle PostgreSQL pool client error', error.stack)
    })

    return pool
  },
  inject: [DRIZZLE_RUNTIME_CONFIG],
}

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
