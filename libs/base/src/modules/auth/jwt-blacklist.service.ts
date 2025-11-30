import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * JWT黑名单服务
 */
@Injectable()
export class JwtBlacklistService {
  // 黑名单缓存前缀
  private readonly BLACKLIST_PREFIX = 'jwt:blacklist:'

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 将令牌添加到黑名单
   */
  async addBlacklist(jti: string, expiresIn: number): Promise<void> {
    await this.cacheManager.set(this.BLACKLIST_PREFIX + jti, true, expiresIn)
  }

  /**
   * 检查令牌是否在黑名单中
   */
  async isInBlacklist(jti: string): Promise<boolean> {
    const result = await this.cacheManager.get(this.BLACKLIST_PREFIX + jti)
    return result === true
  }

  /**
   * 从黑名单中移除令牌
   */
  async removeFromBlacklist(jti: string): Promise<void> {
    await this.cacheManager.del(this.BLACKLIST_PREFIX + jti)
  }
}
