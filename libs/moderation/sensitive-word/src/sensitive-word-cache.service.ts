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

  // 通用缓存读取：命中缓存直接返回，未命中时回源数据库并回填缓存。
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

  // 直接从数据库读取启用中的敏感词，供缓存降级场景复用。
  async loadAllWordsFromDb(): Promise<SensitiveWord[]> {
    return this.db
      .select()
      .from(this.sensitiveWord)
      .where(eq(this.sensitiveWord.isEnabled, true))
  }

  // 正常路径优先读缓存，缓存未命中时回源数据库。
  async getAllWords(): Promise<SensitiveWord[]> {
    return this.getFromCache<SensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS,
      logMessage: (words) => `已缓存 ${words.length} 个敏感词`,
      queryFn: async () => this.loadAllWordsFromDb(),
    })
  }

  // 写路径变更后统一清理全量词缓存。
  async invalidateAll(): Promise<void> {
    await this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS)
    this.logger.log('已清除所有敏感词缓存')
  }

  // 应用启动时预热全量词缓存。
  async preloadCache(): Promise<void> {
    this.logger.log('正在预加载敏感词缓存...')
    const allWords = await this.getAllWords()
    this.logger.log(
      `敏感词缓存预加载成功，共加载 ${allWords.length} 个敏感词`,
    )
  }
}
