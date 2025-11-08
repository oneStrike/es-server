import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'

const PONG_VALUE = 'pong'
function isMemoryStore(store: any) {
  return (
    !!store?.opts?.store?.constructor &&
    store.opts.store.constructor.name === 'CacheableMemory'
  )
}
function makePingKey(label: string) {
  return `health:cache:${label}:ping:${Math.random().toString(36).slice(2)}`
}

@Injectable()
export class CacheHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async checkMemory(key = 'cache_memory') {
    const indicator = this.healthIndicatorService.check(key)
    try {
      const stores: any[] | undefined = (this.cacheManager as any)?.stores
      if (Array.isArray(stores)) {
        for (const store of stores) {
          if (isMemoryStore(store)) {
            const k = makePingKey('memory')
            await store.set(k, PONG_VALUE, 10000)
            const value = await store.get(k)
            if (typeof store.delete === 'function') {
              await store.delete(k)
            } else if (typeof store.del === 'function') {
              await store.del(k)
            }
            if (value !== PONG_VALUE) {
              return indicator.down({ message: 'memory cache ping mismatch' })
            }
            return indicator.up()
          }
        }
      }
      return indicator.down({ message: 'memory cache store not found' })
    } catch (error) {
      return indicator.down({ error: String(error) })
    }
  }

  async checkRedis(key = 'cache_redis') {
    const indicator = this.healthIndicatorService.check(key)
    try {
      const stores: any[] | undefined = (this.cacheManager as any)?.stores
      if (Array.isArray(stores)) {
        for (const store of stores) {
          if (!isMemoryStore(store)) {
            const k = makePingKey('redis')
            await store.set(k, PONG_VALUE, 10000)
            const value = await store.get(k)
            if (typeof store.delete === 'function') {
              await store.delete(k)
            } else if (typeof store.del === 'function') {
              await store.del(k)
            }
            if (value !== PONG_VALUE) {
              return indicator.down({ message: 'redis cache ping mismatch' })
            }
            return indicator.up()
          }
        }
      }
      return indicator.down({ message: 'redis cache store not found' })
    } catch (error) {
      return indicator.down({ error: String(error) })
    }
  }
}
