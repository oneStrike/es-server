import type { Provider } from '@nestjs/common'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import process from 'node:process'
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DrizzleBaseService } from './base.service'
import { relations } from './relations'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema, typeof relations>

@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly pool: Pool
  public readonly db: Db

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const connectionString = configService.get('db.connection')
    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }
    this.pool = new Pool({ connectionString })
    this.db = drizzle({
      client: this.pool,
      schema,
      relations,
      casing: 'snake_case',
      logger: process.env.NODE_ENV === 'development',
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}

export const DrizzleDbProvider: Provider = {
  provide: 'DrizzleDb',
  useFactory: (service: DrizzleService) => service.db,
  inject: [DrizzleService],
}

export { DrizzleBaseService }
