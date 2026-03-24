import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core'
import { BaseDrizzleTokenStorageService } from '@libs/identity/core'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

@Injectable()
export class AppTokenStorageService extends BaseDrizzleTokenStorageService<any> {
  protected get tokenTable() {
    return this.drizzle.schema.appUserToken
  }

  constructor(
    @Inject(DrizzleService) drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(drizzle, cacheManager)
  }
}
