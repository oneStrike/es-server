import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * JWT 黑名单服务。
 * 负责把已撤销 token 的 jti 写入缓存，并在校验链路中快速判断 token 是否失效。
 */
@Injectable()
export class JwtBlacklistService {
  // 黑名单缓存前缀，避免与其它缓存键冲突。
  private readonly BLACKLIST_PREFIX = 'jwt:blacklist:'

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 将 jti 写入黑名单。
   * 过期时间沿用 token 剩余 TTL，确保缓存条目与 token 生命周期一致回收。
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
   * 判断 jti 是否已在黑名单中。
   * 这里不回落数据库，只以缓存为事实源，保持认证链路查询开销最小。
   */
  async isInBlacklist(jti: string): Promise<boolean> {
    const result = await this.cacheManager.get(this.BLACKLIST_PREFIX + jti)
    return result === true
  }

  /**
   * 从黑名单中移除 jti。
   * 仅供测试或人工补偿场景使用，正常业务链路不应主动解封已撤销 token。
   */
  async removeFromBlacklist(jti: string): Promise<void> {
    await this.cacheManager.del(this.BLACKLIST_PREFIX + jti)
  }
}
