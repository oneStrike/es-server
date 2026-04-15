import type { Cache } from 'cache-manager'
import type { CacheQueryConfig } from './sensitive-word.types'
import { DrizzleService } from '@db/core'
import { sensitiveWord } from '@db/schema'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import {
  SENSITIVE_WORD_CACHE_KEYS,
  SENSITIVE_WORD_CACHE_TTL,
} from './sensitive-word-cache.constant'

/** 敏感词实体类型 */
type SensitiveWord = typeof sensitiveWord.$inferSelect

/**
 * 敏感词缓存服务
 * 负责敏感词数据的缓存管理，提供基于不同维度的缓存查询和失效功能
 * 使用 Redis 作为缓存后端，提升敏感词查询性能
 */
@Injectable()
export class SensitiveWordCacheService {
  private readonly logger = new Logger(SensitiveWordCacheService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 敏感词表 */
  private get sensitiveWord() {
    return this.drizzle.schema.sensitiveWord
  }

  /**
   * 通用缓存查询方法
   * 优先从缓存读取，缓存未命中时执行查询函数并更新缓存
   * @param config - 缓存查询配置
   * @returns 查询结果
   */
  private async getFromCache<T>(config: CacheQueryConfig<T>) {
    let data = await this.cacheManager.get<T[]>(config.cacheKey)

    if (!data) {
      data = await config.queryFn()
      await this.cacheManager.set(
        config.cacheKey,
        data,
        SENSITIVE_WORD_CACHE_TTL.LONG,
      )
      this.logger.log(config.logMessage(data))
    }

    return data
  }

  /**
   * 获取所有启用的敏感词
   * 优先从缓存读取，缓存未命中时从数据库查询并更新缓存
   * @returns 敏感词列表
   */
  async getAllWords(): Promise<SensitiveWord[]> {
    return this.getFromCache<SensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS,
      logMessage: (words) => `已缓存 ${words.length} 个敏感词`,
      queryFn: async () =>
        this.db
          .select()
          .from(this.sensitiveWord)
          .where(eq(this.sensitiveWord.isEnabled, true)),
    })
  }

  /**
   * 清除所有敏感词缓存
   * 包括所有维度的缓存和总缓存
   */
  async invalidateAll(): Promise<void> {
    await this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS)
    this.logger.log('已清除所有敏感词缓存')
  }

  /**
   * 预加载敏感词缓存
   * 在应用启动时调用，提前将敏感词数据加载到缓存中
   * 仅预热全量词缓存，避免维护无消费方使用的维度缓存分支
   */
  async preloadCache(): Promise<void> {
    try {
      this.logger.log('正在预加载敏感词缓存...')
      const allWords = await this.getAllWords()
      this.logger.log(
        `敏感词缓存预加载成功，共加载 ${allWords.length} 个敏感词`,
      )
    } catch (error) {
      this.logger.error('预加载敏感词缓存失败', error)
      throw error
    }
  }
}
