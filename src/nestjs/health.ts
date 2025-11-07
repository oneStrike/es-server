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
  type Status = 'ok' | 'not ok'
  const HEALTH_ROUTE = '/api/health'
  const READY_ROUTE = '/api/ready'
  const PONG_VALUE = 'pong'

  const nowISO = () => new Date().toISOString()
  const isMemoryStore = (store: any) =>
    !!store?.opts?.store?.constructor &&
    store.opts.store.constructor.name === 'CacheableMemory'
  const makePingKey = (label: string) =>
    `health:cache:${label}:ping:${Math.random().toString(36).slice(2)}`

  async function checkDatabase() {
    let status: Status = 'ok'
    let errorMessage: string | undefined
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      status = 'not ok'
      errorMessage = String(error)
    }
    return { status, error: errorMessage }
  }

  async function checkCaches(cacheManager: any): Promise<{
    memory: Status
    redis: Status
    errors: Record<string, string>
  }> {
    let memory: Status = 'ok'
    let redis: Status = 'ok'
    const errors: Record<string, string> = {}

    try {
      const stores: any[] | undefined = cacheManager?.stores
      if (Array.isArray(stores) && stores.length > 0) {
        for (const store of stores) {
          const isMem = isMemoryStore(store)
          const label = isMem ? 'memory' : 'redis'
          try {
            const key = makePingKey(label)
            await store.set(key, PONG_VALUE, 10000)
            const value = await store.get(key)
            if (typeof store.delete === 'function') {
              await store.delete(key)
            } else if (typeof store.del === 'function') {
              await store.del(key)
            }

            if (value !== PONG_VALUE) {
              throw new Error(`${label} cache ping value mismatch`)
            }

            if (isMem) {
              memory = 'ok'
            } else {
              redis = 'ok'
            }
          } catch (err) {
            if (isMem) {
              memory = 'not ok'
              errors.memoryCache = String(err)
            } else {
              redis = 'not ok'
              errors.redisCache = String(err)
            }
          }
        }
      }
    } catch (error) {
      // 若逐个或聚合检测出错，根据已判定的类型记录错误
      if (memory === 'ok' && redis !== 'ok') {
        errors.redisCache = String(error)
        redis = 'not ok'
      } else if (redis === 'ok' && memory !== 'ok') {
        errors.memoryCache = String(error)
        memory = 'not ok'
      } else {
        errors.cache = String(error)
        memory = 'not ok'
        redis = 'not ok'
      }
    }

    return { memory, redis, errors }
  }

  // 存活检查端点（Liveness Probe）
  fastifyAdapter.get(HEALTH_ROUTE, async (req, reply) => {
    reply.code(200).send({
      status: 'ok',
      timestamp: nowISO(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      memory: process.memoryUsage(),
    })
  })

  // 就绪检查端点（Readiness Probe）
  fastifyAdapter.get(READY_ROUTE, async (req, reply) => {
    const timestamp = nowISO()

    const { status: dbStatus, error: dbError } = await checkDatabase()
    const cache = app.get<Cache>(CACHE_MANAGER) as any
    const {
      memory: memoryCacheStatus,
      redis: redisCacheStatus,
      errors: cacheErrors,
    } = await checkCaches(cache)

    const errors: Record<string, string> = { ...cacheErrors }
    if (dbError) {
      errors.database = dbError
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
