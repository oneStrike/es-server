import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'

/**
 * 登录锁配置接口
 */
export interface LoginGuardConfig {
  /** 最大尝试次数 */
  maxAttempts: number
  /** 失败计数过期时间（秒） */
  failTtl: number
  /** 锁定时长（秒） */
  lockTtl: number
}

/**
 * 登录安全防护服务
 * 提供基于 Redis 的登录失败锁定机制
 */
@Injectable()
export class LoginGuardService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * 检查是否被锁定
   * @param lockKey 锁定Key
   * @throws BadRequestException 如果被锁定，抛出包含剩余时间的异常
   */
  async checkLock(lockKey: string) {
    const unlockTime = await this.cacheManager.get<number>(lockKey)
    if (unlockTime && unlockTime > Date.now()) {
      const minutes = Math.ceil((unlockTime - Date.now()) / 1000 / 60)
      throw new BadRequestException(`账号已锁定，请在 ${minutes} 分钟后重试`)
    }
  }

  /**
   * 记录失败并检查是否需要锁定
   * @param failKey 失败计数Key
   * @param lockKey 锁定Key
   * @param config 配置参数
   * @throws BadRequestException 抛出密码错误提示（含剩余次数）或锁定提示
   */
  async recordFail(failKey: string, lockKey: string, config: LoginGuardConfig) {
    // 获取当前失败次数
    const count = ((await this.cacheManager.get<number>(failKey)) || 0) + 1

    // 更新失败次数，每次都重置 TTL
    await this.cacheManager.set(failKey, count, config.failTtl * 1000)

    // 检查是否达到锁定阈值
    if (count >= config.maxAttempts) {
      // 锁定账号，存储解锁时间戳
      const unlockTime = Date.now() + config.lockTtl * 1000
      await this.cacheManager.set(lockKey, unlockTime, config.lockTtl * 1000)

      const minutes = Math.ceil(config.lockTtl / 60)
      throw new BadRequestException(`账号已锁定，请在 ${minutes} 分钟后重试`)
    }

    const remaining = config.maxAttempts - count
    throw new BadRequestException(`账号或密码错误，还剩 ${remaining} 次机会`)
  }

  /**
   * 清除登录失败计数
   * @param failKey 失败计数Key
   */
  async clearHistory(failKey: string) {
    await this.cacheManager.del(failKey)
  }
}
