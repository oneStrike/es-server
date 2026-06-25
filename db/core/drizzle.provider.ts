import type { Provider } from '@nestjs/common'
import type { Db } from './drizzle.type'
import process from 'node:process'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from './drizzle-relations'

// Internal raw pg Pool token. Keep it out of @db/core's public barrel; inject it
// only for driver-level features such as LISTEN/NOTIFY or lifecycle management.
export const DRIZZLE_POOL = 'DRIZZLE_POOL'
export const DRIZZLE_DB = 'DRIZZLE_DB'

export const DrizzlePoolProvider: Provider = {
  provide: DRIZZLE_POOL,
  useFactory: (configService: ConfigService): Pool => {
    const connectionString =
      configService.get<string>('db.connection') ??
      configService.get<string>('DATABASE_URL') ??
      process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }

    const max = configService.get<number>('db.pool.max') ?? 20

    return new Pool({
      connectionString,
      max,
    })
  },
  inject: [ConfigService],
}

export const DrizzleDbProvider: Provider = {
  provide: DRIZZLE_DB,
  useFactory: (pool: Pool): Db =>
    drizzle({
      client: pool,
      relations,
      jit: true,
      // logger: process.env.NODE_ENV === 'development',
      logger: false,
    }),
  inject: [DRIZZLE_POOL],
}
