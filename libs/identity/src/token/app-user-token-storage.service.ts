import type { AppUserTokenSelect } from '@db/schema'
import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core'
import { BaseDrizzleTokenStorageService } from '@libs/identity/token/drizzle-token-storage.base'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * APP 用户 token 存储服务。
 * 统一收敛 app_user_token 的读写与撤销能力，供 app-api 与管理端共享。
 */
@Injectable()
export class AppUserTokenStorageService extends BaseDrizzleTokenStorageService<AppUserTokenSelect> {
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
