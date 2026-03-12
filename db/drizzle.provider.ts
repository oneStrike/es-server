import type { Provider } from '@nestjs/common'
import type { Db } from './index'
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { drizzleConfig } from './schema/drizzle'

@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly pool: Pool
  public readonly db: Db

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const connectionString = this.configService.get('db.connection')

    if (!connectionString) {
      throw new Error('Missing db.connection (DATABASE_URL) configuration')
    }

    this.pool = new Pool({ connectionString })
    this.db = drizzle({ client: this.pool, ...drizzleConfig })
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
