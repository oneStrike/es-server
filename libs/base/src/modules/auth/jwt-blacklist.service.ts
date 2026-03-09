import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * JWT榛戝悕鍗曟湇鍔?
 */
@Injectable()
export class JwtBlacklistService {
  // 榛戝悕鍗曠紦瀛樺墠缂€
  private readonly BLACKLIST_PREFIX = 'jwt:blacklist:'

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 灏嗕护鐗屾坊鍔犲埌榛戝悕鍗?
   */
  async addBlacklist(jti: string, expiresInMs: number): Promise<void> {
    if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) {
      return
    }
    await this.cacheManager.set(
      this.BLACKLIST_PREFIX + jti,
      true,
      Math.floor(expiresInMs),
    )
  }

  /**
   * 妫€鏌ヤ护鐗屾槸鍚﹀湪榛戝悕鍗曚腑
   */
  async isInBlacklist(jti: string): Promise<boolean> {
    const result = await this.cacheManager.get(this.BLACKLIST_PREFIX + jti)
    return result === true
  }

  /**
   * 浠庨粦鍚嶅崟涓Щ闄や护鐗?
   */
  async removeFromBlacklist(jti: string): Promise<void> {
    await this.cacheManager.del(this.BLACKLIST_PREFIX + jti)
  }
}
