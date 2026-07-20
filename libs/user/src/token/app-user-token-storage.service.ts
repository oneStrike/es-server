import type { Cache } from 'cache-manager'
import { BaseTokenStorageService } from '@libs/platform/modules/auth/base-token-storage.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { AppUserTokenPersistenceAdapter } from './app-user-token-persistence.adapter'

/** APP 用户 token 存储服务，组合用户域持久化适配器与平台缓存语义。 */
@Injectable()
export class AppUserTokenStorageService extends BaseTokenStorageService {
  constructor(
    persistence: AppUserTokenPersistenceAdapter,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(persistence, cacheManager)
  }
}
