import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import type { Cache } from 'cache-manager'
import * as process from 'node:process'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { prisma } from '@/prisma/prisma.connect'

/**
 * 配置健康检查端点
 * 用于 Docker/Kubernetes 存活和就绪探针
 */
export function setupHealthChecks(
  fastifyAdapter: FastifyAdapter,
  app: NestFastifyApplication,
) {
  // 存活检查端1点（Liveness Probe）
  fastifyAdapter.get('/api/health', async (req, reply) => {
    reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      memory: process.memoryUsage(),
    })
  })

  // 就绪检查端点（Readiness Probe）
  fastifyAdapter.get('/api/ready', async (req, reply) => {
    const timestamp = new Date().toISOString()

    // 数据库健康检查
    let dbStatus: 'ok' | 'not ok' = 'ok'
    let memoryCacheStatus: 'ok' | 'not ok' = 'ok'
    let redisCacheStatus: 'ok' | 'not ok' = 'ok'
    const errors: Record<string, string> = {}

    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      dbStatus = 'not ok'
      errors.database = String(error)
    }

    // 使用 Nest 的 CacheManager 检测各缓存（优先逐个 store 检测）
    try {
      const cache = app.get<Cache>(CACHE_MANAGER) as any
      const stores: any[] | undefined = cache?.stores

      if (Array.isArray(stores) && stores.length > 0) {
        for (const store of stores) {
          // 依据特征粗略判断 store 类型（内存/Redis）
          const isMemory =
            !!store?.opts?.store?.constructor &&
            store.opts.store.constructor.name === 'CacheableMemory'
          const storeLabel = isMemory ? 'memory' : 'redis'
          try {
            const key = `health:cache:${storeLabel}:ping:${Math.random().toString(36).slice(2)}`
            await store.set(key, 'pong', 10000)
            const value = await store.get(key)
            if (typeof store.delete === 'function') {
              await store.delete(key)
            } else if (typeof store.del === 'function') {
              await store.del(key)
            }

            if (value !== 'pong') {
              throw new Error(`${storeLabel} cache ping value mismatch`)
            }

            if (isMemory) {
              memoryCacheStatus = 'ok'
            } else {
              redisCacheStatus = 'ok'
            }
          } catch (err) {
            if (isMemory) {
              memoryCacheStatus = 'not ok'
              errors.memoryCache = String(err)
            } else {
              redisCacheStatus = 'not ok'
              errors.redisCache = String(err)
            }
          }
        }
      }
    } catch (error) {
      // 若逐个或聚合检测出错，根据已判定的类型记录错误
      if (memoryCacheStatus === 'ok' && redisCacheStatus !== 'ok') {
        errors.redisCache = String(error)
        redisCacheStatus = 'not ok'
      } else if (redisCacheStatus === 'ok' && memoryCacheStatus !== 'ok') {
        errors.memoryCache = String(error)
        memoryCacheStatus = 'not ok'
      } else {
        errors.cache = String(error)
        memoryCacheStatus = 'not ok'
        redisCacheStatus = 'not ok'
      }
    }

    const ready =
      dbStatus === 'ok' &&
      memoryCacheStatus === 'ok' &&
      redisCacheStatus === 'ok'
    reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not ready',
      timestamp,
      checks: {
        database: dbStatus,
        cache: {
          memory: memoryCacheStatus,
          redis: redisCacheStatus,
        },
      },
      ...(Object.keys(errors).length ? { errors } : {}),
    })
  })
}
