import type { Provider } from '@nestjs/common'
import type { Db } from './drizzle.type'
import process from 'node:process'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from '../relations'
import * as schema from '../schema'

export const DRIZZLE_POOL = 'DRIZZLE_POOL'
export const DRIZZLE_DB = 'DRIZZLE_DB'
export const DRIZZLE_DB_LEGACY = 'DrizzleDb'
export const PG_CONNECTION = DRIZZLE_DB

export const DrizzlePoolProvider: Provider = {
  provide: DRIZZLE_POOL,
  useFactory: (configService: ConfigService): Pool => {
    const connectionString = configService.get<string>('db.connection')
    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }

    return new Pool({
      connectionString,
    })
  },
  inject: [ConfigService],
}

export const DrizzleDbProvider: Provider = {
  provide: DRIZZLE_DB,
  useFactory: (pool: Pool): Db =>
    drizzle({
      client: pool,
      schema,
      relations,
      casing: 'snake_case',
      // logger: process.env.NODE_ENV === 'development',
      logger: false,
    }),
  inject: [DRIZZLE_POOL],
}

export const DrizzleDbLegacyProvider: Provider = {
  provide: DRIZZLE_DB_LEGACY,
  useExisting: DRIZZLE_DB,
}
