import type { adminUserToken } from '@db/schema'
import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { BaseDrizzleTokenStorageService } from './drizzle-token-storage.base'

/** 管理员用户 token 存储服务，统一归属身份域。 */
@Injectable()
export class AdminUserTokenStorageService extends BaseDrizzleTokenStorageService<
  typeof adminUserToken.$inferSelect
> {
  protected get tokenTable() {
    return this.drizzle.schema.adminUserToken
  }

  constructor(
    @Inject(DrizzleService) drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(drizzle, cacheManager)
  }
}
