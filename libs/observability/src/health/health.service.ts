import type { Cache } from 'cache-manager'
import type { CacheManagerLike, CacheStoreLike } from './health.type'
import { buildSafeDatabaseDiagnostic, DrizzleService } from '@db/core'
import { isDevelopment, isProduction } from '@libs/platform/utils'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'

const PONG_VALUE = 'pong'
const SAFE_ERROR_NAME_PATTERN = /^[a-z][\w.-]{0,63}$/i

function isMemoryStore(store: CacheStoreLike | undefined) {
  return (
    !!store?.opts?.store?.constructor &&
    store.opts.store.constructor.name === 'CacheableMemory'
  )
}

function makePingKey(label: string) {
  return `health:cache:${label}:ping:${Math.random().toString(36).slice(2)}`
}

/**
 * 健康检查服务
 * 负责数据库与缓存的可用性探测
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name)

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly drizzle: DrizzleService,
  ) {}

  // 检查数据库健康状态
  async ping(key = 'database') {
    try {
      await this.drizzle.db.execute(sql`SELECT 1`)
      return {
        [key]: {
          status: 'up',
        },
      }
    } catch (error) {
      this.logger.warn('Database health check failed', {
        database: buildSafeDatabaseDiagnostic(error),
      })
      return {
        [key]: {
          status: 'down',
          message: 'database unavailable',
        },
      }
    }
  }

  // 检查内存缓存健康状态
  async checkMemory(key = 'cache_memory') {
    try {
      const stores = (this.cacheManager as Cache & CacheManagerLike).stores
      if (Array.isArray(stores)) {
        for (const store of stores) {
          if (isMemoryStore(store)) {
            if (!store.set || !store.get) {
              continue
            }
            const k = makePingKey('memory')
            await store.set(k, PONG_VALUE, 10000)
            const value: unknown = await store.get(k)
            if (typeof store.delete === 'function') {
              await store.delete(k)
            } else if (typeof store.del === 'function') {
              await store.del(k)
            }
            if (value !== PONG_VALUE) {
              return {
                [key]: {
                  status: 'down',
                  message: 'memory cache ping mismatch',
                },
              }
            }
            return {
              [key]: {
                status: 'up',
              },
            }
          }
        }
      }
      return {
        [key]: {
          status: 'down',
          message: 'memory cache store not found',
        },
      }
    } catch (error) {
      this.logger.warn('Memory cache health check failed', {
        error: describeHealthError(error),
      })
      return {
        [key]: {
          status: 'down',
          message: 'memory cache unavailable',
        },
      }
    }
  }

  // 检查 Redis 缓存健康状态
  async checkRedis(key = 'cache_redis') {
    try {
      const stores = (this.cacheManager as Cache & CacheManagerLike).stores
      if (Array.isArray(stores)) {
        for (const store of stores) {
          if (!isMemoryStore(store)) {
            if (!store.set || !store.get) {
              continue
            }
            const k = makePingKey('redis')
            await store.set(k, PONG_VALUE, 10000)
            const value: unknown = await store.get(k)
            if (typeof store.delete === 'function') {
              await store.delete(k)
            } else if (typeof store.del === 'function') {
              await store.del(k)
            }
            if (value !== PONG_VALUE) {
              return {
                [key]: {
                  status: 'down',
                  message: 'redis cache ping mismatch',
                },
              }
            }
            return {
              [key]: {
                status: 'up',
              },
            }
          }
        }
      }
      return {
        [key]: {
          status: 'down',
          message: 'redis cache store not found',
        },
      }
    } catch (error) {
      this.logger.warn('Redis cache health check failed', {
        error: describeHealthError(error),
      })
      return {
        [key]: {
          status: 'down',
          message: 'redis cache unavailable',
        },
      }
    }
  }

  // 根据环境检查相应类型的缓存健康状态 开发环境只检查内存缓存，生产环境只检查Redis缓存
  async checkCacheByEnv(key = 'cache') {
    // 开发环境和测试环境只检查内存缓存
    if (isDevelopment()) {
      return this.checkMemory(key)
    }

    // 生产环境只检查Redis缓存
    if (isProduction()) {
      return this.checkRedis(key)
    }

    // 默认情况下（如其他环境）检查内存缓存
    return this.checkMemory(key)
  }
}

function describeHealthError(error: unknown): { errorName: string } {
  return {
    errorName:
      error instanceof Error && SAFE_ERROR_NAME_PATTERN.test(error.name)
        ? error.name
        : 'UnknownError',
  }
}
