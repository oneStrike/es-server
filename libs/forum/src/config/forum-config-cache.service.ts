import type { ForumConfig } from '@libs/base/database'
import type { Cache } from 'cache-manager'
import { BaseService } from '@libs/base/database'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  FORUM_CONFIG_CACHE_KEYS,
  FORUM_CONFIG_CACHE_METRICS,
  FORUM_CONFIG_CACHE_TTL,
} from './forum-config-cache.constant'
import { DEFAULT_FORUM_CONFIG } from './forum-config.constant'

/**
 * 论坛配置缓存服务
 * 负责论坛配置的读取与缓存失效处理
 */
@Injectable()
export class ForumConfigCacheService extends BaseService {
  private readonly logger = new Logger(ForumConfigCacheService.name)

  private pendingRequests = new Map<string, Promise<ForumConfig>>()

  get forumConfig() {
    return this.prisma.forumConfig
  }

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    super()
  }

  /**
   * 获取论坛配置
   * 优先从缓存读取，缓存未命中时从数据库查询并更新缓存
   * 如果数据库中没有配置，自动创建默认配置
   *
   * 缓存保护：
   * - 缓存穿透：缓存空值（NULL_VALUE TTL）
   * - 缓存击穿：使用单飞模式
   * - 缓存雪崩：TTL 加上随机值
   *
   * @returns 论坛配置（保证返回有效配置）
   */
  async getConfig() {
    const cacheKey = FORUM_CONFIG_CACHE_KEYS.CONFIG
    const requestKey = `lock:${cacheKey}`

    const config = await this.cacheManager.get<ForumConfig | null>(cacheKey)

    if (config) {
      await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.HIT_COUNT)
      return config
    }

    await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.MISS_COUNT)

    if (this.pendingRequests.has(requestKey)) {
      await this.incrementMetric(FORUM_CONFIG_CACHE_METRICS.PENETRATION_COUNT)
      return this.pendingRequests.get(requestKey)!
    }

    const promise = this.loadConfigFromDatabase(cacheKey)
    this.pendingRequests.set(requestKey, promise)
    return promise
  }

  /**
   * 从数据库加载配置并更新缓存
   * 如果数据库中没有配置，自动创建默认配置
   * @param cacheKey - 缓存键
   * @returns 论坛配置
   */
  private async loadConfigFromDatabase(cacheKey: string): Promise<ForumConfig> {
    try {
      const requestKey = `lock:${cacheKey}`

      const config = await this.forumConfig.findFirst()

      if (config) {
        const ttl = this.getRandomTTL(FORUM_CONFIG_CACHE_TTL.LONG)
        await this.cacheManager.set(cacheKey, config, ttl)
        this.logger.log(`已缓存论坛配置 ID: ${config.id}, TTL: ${ttl}秒`)
      } else {
        this.logger.warn('未找到论坛配置，正在创建默认配置...')
        const newConfig = await this.createDefaultConfig()
        const ttl = this.getRandomTTL(FORUM_CONFIG_CACHE_TTL.LONG)
        await this.cacheManager.set(cacheKey, newConfig, ttl)
        this.logger.log(
          `已创建并缓存默认论坛配置 ID: ${newConfig.id}, TTL: ${ttl}秒`,
        )
        this.pendingRequests.delete(requestKey)
        return newConfig
      }

      this.pendingRequests.delete(requestKey)
      return config
    } catch (error) {
      const requestKey = `lock:${cacheKey}`
      this.pendingRequests.delete(requestKey)
      this.logger.error(
        `从数据库加载论坛配置失败: ${error.message}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 清除论坛配置缓存
   * 配置更新时调用此方法清除缓存
   */
  async invalidateConfig(): Promise<void> {
    try {
      await this.cacheManager.del(FORUM_CONFIG_CACHE_KEYS.CONFIG)
      this.logger.log('已清除论坛配置缓存')
    } catch (error) {
      this.logger.error(`清除论坛配置缓存失败: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 创建默认论坛配置
   * @returns 论坛配置
   */
  private async createDefaultConfig(): Promise<ForumConfig> {
    try {
      const config = await this.forumConfig.create({
        data: DEFAULT_FORUM_CONFIG,
      })
      this.logger.log(`已创建默认论坛配置 ID: ${config.id}`)
      return config
    } catch (error) {
      this.logger.error(`创建默认论坛配置失败: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 预加载论坛配置缓存
   * 在应用启动时调用，提前将配置数据加载到缓存中
   */
  async preloadCache(): Promise<void> {
    try {
      this.logger.log('正在预加载论坛配置缓存...')
      const config = await this.getConfig()
      if (config) {
        this.logger.log(`论坛配置缓存预加载成功，配置ID: ${config.id}`)
      } else {
        this.logger.warn('未找到论坛配置，跳过预加载')
      }
    } catch (error) {
      this.logger.error('预加载论坛配置缓存失败', error)
      throw error
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  async getCacheStats(): Promise<{
    hitCount: number
    missCount: number
    penetrationCount: number
    hitRate: number
  }> {
    try {
      const [hitCount, missCount, penetrationCount] = await Promise.all([
        this.getMetric(FORUM_CONFIG_CACHE_METRICS.HIT_COUNT),
        this.getMetric(FORUM_CONFIG_CACHE_METRICS.MISS_COUNT),
        this.getMetric(FORUM_CONFIG_CACHE_METRICS.PENETRATION_COUNT),
      ])

      const totalRequests = hitCount + missCount
      const hitRate = totalRequests > 0 ? hitCount / totalRequests : 0

      return {
        hitCount,
        missCount,
        penetrationCount,
        hitRate,
      }
    } catch (error) {
      this.logger.error(`获取缓存统计信息失败: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 获取带随机值的 TTL
   * 防止缓存雪崩
   * @param baseTTL - 基础 TTL
   * @returns 带 +/- 10% 随机值的 TTL
   */
  private getRandomTTL(baseTTL: number): number {
    const randomOffset = Math.floor(baseTTL * 0.1)
    const randomValue =
      Math.floor(Math.random() * (2 * randomOffset + 1)) - randomOffset
    return baseTTL + randomValue
  }

  /**
   * 增加监控指标
   * @param metricKey - 指标键
   */
  private async incrementMetric(metricKey: string) {
    try {
      const currentValue = await this.getMetric(metricKey)
      await this.cacheManager.set(metricKey, currentValue + 1, 86400)
    } catch (error) {
      this.logger.error(`增加监控指标失败: ${metricKey}`, error.stack)
    }
  }

  /**
   * 获取监控指标
   * @param metricKey - 指标键
   * @returns 指标值
   */
  private async getMetric(metricKey: string) {
    try {
      const value = await this.cacheManager.get<number>(metricKey)
      return value || 0
    } catch (error) {
      this.logger.error(`获取监控指标失败: ${metricKey}`, error.stack)
      return 0
    }
  }
}
