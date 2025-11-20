import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { Cache } from 'cache-manager'

/**
 * JWT黑名单服务
 */
@Injectable()
export class JwtBlacklistService {
  // 黑名单缓存前缀
  private readonly ADMIN_BLACKLIST_PREFIX = 'jwt:blacklist:admin:'
  private readonly CLIENT_BLACKLIST_PREFIX = 'jwt:blacklist:client:'

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 将令牌添加到管理员黑名单
   */
  async addToAdminBlacklist(jti: string, expiresIn: number): Promise<void> {
    await this.cacheManager.set(
      this.ADMIN_BLACKLIST_PREFIX + jti,
      true,
      expiresIn,
    )
  }

  /**
   * 将令牌添加到客户端黑名单
   */
  async addToClientBlacklist(jti: string, expiresIn: number): Promise<void> {
    await this.cacheManager.set(
      this.CLIENT_BLACKLIST_PREFIX + jti,
      true,
      expiresIn,
    )
  }

  /**
   * 检查令牌是否在管理员黑名单中
   */
  async isInAdminBlacklist(jti: string): Promise<boolean> {
    const result = await this.cacheManager.get(
      this.ADMIN_BLACKLIST_PREFIX + jti,
    )
    return result === true
  }

  /**
   * 检查令牌是否在客户端黑名单中
   */
  async isInClientBlacklist(jti: string): Promise<boolean> {
    const result = await this.cacheManager.get(
      this.CLIENT_BLACKLIST_PREFIX + jti,
    )
    return result === true
  }

  /**
   * 从管理员黑名单中移除令牌
   */
  async removeFromAdminBlacklist(jti: string): Promise<void> {
    await this.cacheManager.del(this.ADMIN_BLACKLIST_PREFIX + jti)
  }

  /**
   * 从客户端黑名单中移除令牌
   */
  async removeFromClientBlacklist(jti: string): Promise<void> {
    await this.cacheManager.del(this.CLIENT_BLACKLIST_PREFIX + jti)
  }
}
