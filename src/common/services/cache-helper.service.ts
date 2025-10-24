import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'

/**
 * 缓存辅助服务
 * 提供统一的缓存操作接口和性能监控
 */
@Injectable()
export class CacheHelperService {
  private readonly logger: CustomLoggerService

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private loggerFactory: LoggerFactoryService,
  ) {
    this.logger = this.loggerFactory.createGlobalLogger('CacheHelperService')
  }

  /**
   * 获取缓存数据，如果不存在则执行回调函数获取并缓存
   * @param key 缓存键
   * @param fetchFn 获取数据的回调函数
   * @param ttl 缓存时间（毫秒），默认5分钟
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300000,
  ): Promise<T> {
    const startTime = Date.now()

    // 尝试从缓存获取
    const cached = await this.cacheManager.get<T>(key)
    if (cached !== undefined && cached !== null) {
      const duration = Date.now() - startTime
      this.logger.debug('缓存命中', { key, duration })
      return cached
    }

    // 缓存未命中，执行回调获取数据
    this.logger.debug('缓存未命中，从数据源获取', { key })
    const data = await fetchFn()

    // 存入缓存
    await this.cacheManager.set(key, data, ttl)

    const duration = Date.now() - startTime
    this.logger.debug('数据已缓存', { key, ttl, duration })

    return data
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 缓存时间（毫秒）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl)
    this.logger.debug('缓存已设置', { key, ttl })
  }

  /**
   * 获取缓存
   * @param key 缓存键
   */
  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key)
    if (value !== undefined && value !== null) {
      this.logger.debug('缓存命中', { key })
    }
    else {
      this.logger.debug('缓存未命中', { key })
    }
    return value
  }

  /**
   * 删除缓存
   * @param key 缓存键或键数组
   */
  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      await Promise.all(key.map(async k => this.cacheManager.del(k)))
      this.logger.debug('批量删除缓存', { count: key.length })
    }
    else {
      await this.cacheManager.del(key)
      this.logger.debug('缓存已删除', { key })
    }
  }

  /**
   * 清空所有缓存
   */
  async reset(): Promise<void> {
    // cache-manager v5 不再支持 reset，需要自行实现
    // 这里只记录日志，实际项目中可以使用 Redis 的 FLUSHDB
    this.logger.warn('清空所有缓存功能需要额外实现')
  }

  /**
   * 包装函数，自动处理缓存
   * @param cacheKey 缓存键生成函数
   * @param ttl 缓存时间
   */
  wrapWithCache<T extends any[], R>(
    cacheKey: (...args: T) => string,
    ttl: number = 300000,
  ) {
    return (fn: (...args: T) => Promise<R>) => {
      return async (...args: T): Promise<R> => {
        const key = cacheKey(...args)
        return this.getOrSet(key, async () => fn(...args), ttl)
      }
    }
  }

  /**
   * 生成用户缓存键
   */
  getUserCacheKey(userId: number): string {
    return `user:${userId}`
  }

  /**
   * 生成字典缓存键
   */
  getDictCacheKey(code: string): string {
    return `dict:${code}`
  }

  /**
   * 生成列表缓存键
   */
  getListCacheKey(type: string, params: Record<string, any>): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(':')
    return `list:${type}:${paramStr}`
  }

  /**
   * 删除用户相关的所有缓存
   */
  async clearUserCache(userId: number): Promise<void> {
    await this.del(this.getUserCacheKey(userId))
    this.logger.info('用户缓存已清除', { userId })
  }

  /**
   * 删除字典相关的所有缓存
   */
  async clearDictCache(code?: string): Promise<void> {
    if (code) {
      await this.del(this.getDictCacheKey(code))
      this.logger.info('字典缓存已清除', { code })
    }
    else {
      // 这里可以实现模式匹配删除，但需要额外的缓存存储支持
      this.logger.warn('删除所有字典缓存功能待实现')
    }
  }
}
