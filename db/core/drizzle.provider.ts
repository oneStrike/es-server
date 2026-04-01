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
    const sessionTimeZone =
      configService.get<string>('TZ')?.trim() ||
      process.env.TZ?.trim() ||
      'Asia/Shanghai'

    return new Pool({
      connectionString,
      // `pg-pool` 会等待 onConnect 返回的 Promise 完成后再交付连接，
      // 这里必须把会话时区初始化留在获取连接的关键路径上。
      // eslint-disable-next-line ts/no-misused-promises
      onConnect: async (client) => {
        await client.query('SELECT set_config($1, $2, false)', [
          'TimeZone',
          sessionTimeZone,
        ])
      },
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
