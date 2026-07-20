import type { Cache } from 'cache-manager'
import { BaseTokenStorageService } from '@libs/platform/modules/auth/base-token-storage.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { AdminUserTokenPersistenceAdapter } from './admin-user-token-persistence.adapter'

/** 管理端用户 token 存储服务，组合管理端持久化适配器与平台缓存语义。 */
@Injectable()
export class AdminUserTokenStorageService extends BaseTokenStorageService {
  constructor(
    persistence: AdminUserTokenPersistenceAdapter,
    @Inject(CACHE_MANAGER) cacheManager: Cache,
  ) {
    super(persistence, cacheManager)
  }
}
