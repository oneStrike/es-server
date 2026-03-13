import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import { Pool } from 'pg'
import { createDrizzleExtensions } from './drizzle.extensions'
import { Db, DRIZZLE_DB, DRIZZLE_POOL } from './drizzle.provider'
import * as schema from './schema'

@Injectable()
export class DrizzleService implements OnApplicationShutdown {
  public readonly ext: ReturnType<typeof createDrizzleExtensions>

  constructor(
    @Inject(DRIZZLE_DB) public readonly db: Db,
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {
    this.ext = createDrizzleExtensions(this.db)
  }

  get schema(): typeof schema {
    return schema
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
