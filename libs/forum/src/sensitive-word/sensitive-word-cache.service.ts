import type { ForumSensitiveWord } from '@libs/base/database'
import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  SENSITIVE_WORD_CACHE_KEYS,
  SENSITIVE_WORD_CACHE_TTL,
} from './sensitive-word-cache.constant'
import { SensitiveWordService } from './sensitive-word.service'

/**
 * 缓存查询配置接口
 */
interface CacheQueryConfig<T> {
  cacheKey: string
  logMessage: (data: T[]) => string
  queryFn: () => Promise<T[]>
}

/**
 * 敏感词缓存服务
 * 负责敏感词数据的缓存管理，提供基于不同维度的缓存查询和失效功能
 * 使用 Redis 作为缓存后端，提升敏感词查询性能
 */
@Injectable()
export class SensitiveWordCacheService {
  private readonly logger = new Logger(SensitiveWordCacheService.name)

  constructor(
    private readonly sensitiveWordService: SensitiveWordService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 通用缓存查询方法
   * 优先从缓存读取，缓存未命中时执行查询函数并更新缓存
   * @param config - 缓存查询配置
   * @returns 查询结果
   */
  private async getFromCache<T>(config: CacheQueryConfig<T>): Promise<T[]> {
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
  async getAllWords(): Promise<ForumSensitiveWord[]> {
    return this.getFromCache<ForumSensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.ALL_WORDS,
      logMessage: (words) => `已缓存 ${words.length} 个敏感词`,
      queryFn: async () =>
        this.sensitiveWordService.sensitiveWord.findMany({
          where: {
            isEnabled: true,
          },
        }),
    })
  }

  /**
   * 根据敏感等级获取敏感词列表
   * 优先从缓存读取，缓存未命中时从数据库查询并更新缓存
   * @param level - 敏感等级（1-低，2-中，3-高）
   * @returns 敏感词列表
   */
  async getWordsByLevel(level: number): Promise<ForumSensitiveWord[]> {
    return this.getFromCache<ForumSensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_LEVEL(level),
      logMessage: (words) => `已缓存等级 ${level} 的 ${words.length} 个敏感词`,
      queryFn: async () =>
        this.sensitiveWordService.sensitiveWord.findMany({
          where: {
            isEnabled: true,
            level,
          },
        }),
    })
  }

  /**
   * 根据敏感词类型获取敏感词列表
   * 优先从缓存读取，缓存未命中时从数据库查询并更新缓存
   * @param type - 敏感词类型（如：政治、色情、暴力等）
   * @returns 敏感词列表
   */
  async getWordsByType(type: number): Promise<ForumSensitiveWord[]> {
    return this.getFromCache<ForumSensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_TYPE(type),
      logMessage: (words) => `已缓存类型 ${type} 的 ${words.length} 个敏感词`,
      queryFn: async () =>
        this.sensitiveWordService.sensitiveWord.findMany({
          where: {
            isEnabled: true,
            type,
          },
        }),
    })
  }

  /**
   * 根据匹配模式获取敏感词列表
   * 优先从缓存读取，缓存未命中时从数据库查询并更新缓存
   * @param matchMode - 匹配模式（1-精确匹配，2-模糊匹配）
   * @returns 敏感词列表
   */
  async getWordsByMatchMode(matchMode: number): Promise<ForumSensitiveWord[]> {
    return this.getFromCache<ForumSensitiveWord>({
      cacheKey: SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_MATCH_MODE(matchMode),
      logMessage: (words) =>
        `已缓存匹配模式 ${matchMode} 的 ${words.length} 个敏感词`,
      queryFn: async () =>
        this.sensitiveWordService.sensitiveWord.findMany({
          where: {
            isEnabled: true,
            matchMode,
          },
        }),
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
   * 清除指定等级的敏感词缓存
   * 只清除该等级的缓存，不影响其他维度
   * @param level - 敏感等级
   */
  async invalidateByLevel(level: number): Promise<void> {
    await this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_LEVEL(level))
    this.logger.log(`已清除等级 ${level} 的敏感词缓存`)
  }

  /**
   * 清除指定类型的敏感词缓存
   * 只清除该类型的缓存，不影响其他维度
   * @param type - 敏感词类型
   */
  async invalidateByType(type: number): Promise<void> {
    await this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_TYPE(type))
    this.logger.log(`已清除类型 ${type} 的敏感词缓存`)
  }

  /**
   * 清除指定匹配模式的敏感词缓存
   * 只清除该匹配模式的缓存，不影响其他维度
   * @param matchMode - 匹配模式
   */
  async invalidateByMatchMode(matchMode: number): Promise<void> {
    await this.cacheManager.del(
      SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_MATCH_MODE(matchMode),
    )
    this.logger.log(`已清除匹配模式 ${matchMode} 的敏感词缓存`)
  }

  /**
   * 清除所有维度的缓存
   * 清除所有等级、类型和匹配模式的缓存
   */
  async invalidateAllDimensions(): Promise<void> {
    const allWords = await this.getAllWords()
    const levels = [...new Set(allWords.map((word) => word.level))]
    const types = [...new Set(allWords.map((word) => word.type))]
    const matchModes = [...new Set(allWords.map((word) => word.matchMode))]

    const deletePromises = [
      ...levels.map(async (level) =>
        this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_LEVEL(level)),
      ),
      ...types.map(async (type) =>
        this.cacheManager.del(SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_TYPE(type)),
      ),
      ...matchModes.map(async (matchMode) =>
        this.cacheManager.del(
          SENSITIVE_WORD_CACHE_KEYS.WORDS_BY_MATCH_MODE(matchMode),
        ),
      ),
    ]

    await Promise.all(deletePromises)
    await this.invalidateAll()
    this.logger.log('已清除所有维度的敏感词缓存')
  }

  /**
   * 预加载敏感词缓存
   * 在应用启动时调用，提前将敏感词数据加载到缓存中
   * 预加载所有维度的缓存以提升首次查询性能
   */
  async preloadCache(): Promise<void> {
    try {
      this.logger.log('正在预加载敏感词缓存...')
      const allWords = await this.getAllWords()

      const levels = [...new Set(allWords.map((word) => word.level))]
      const types = [...new Set(allWords.map((word) => word.type))]
      const matchModes = [...new Set(allWords.map((word) => word.matchMode))]

      const preloadPromises = [
        ...levels.map(async (level) => this.getWordsByLevel(level)),
        ...types.map(async (type) => this.getWordsByType(type)),
        ...matchModes.map(async (matchMode) =>
          this.getWordsByMatchMode(matchMode),
        ),
      ]

      await Promise.all(preloadPromises)
      this.logger.log(
        `敏感词缓存预加载成功，共加载 ${allWords.length} 个敏感词`,
      )
    } catch (error) {
      this.logger.error('预加载敏感词缓存失败', error)
      throw error
    }
  }
}
