import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import * as process from 'node:process'
import KeyvRedis from '@keyv/redis'
import { ConfigService } from '@nestjs/config'
import { CacheableMemory } from 'cacheable'
import { Keyv } from 'keyv'
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

    // 内存缓存健康检查（使用独立的 Keyv 内存存储）
    try {
      const memoryKeyv = new Keyv({
        store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
      })
      const key = `health:cache:memory:ping:${Math.random().toString(36).slice(2)}`
      await memoryKeyv.set(key, 'pong', 10000)
      const value = await memoryKeyv.get<string>(key)
      await memoryKeyv.delete(key)
      if (value !== 'pong') {
        throw new Error('memory cache ping value mismatch')
      }
    } catch (error) {
      memoryCacheStatus = 'not ok'
      errors.memoryCache = String(error)
    }

    // Redis 缓存健康检查（构建与 AppModule 相同的连接配置）
    try {
      const config = app.get(ConfigService)
      const host = config.get<string>('REDIS_HOST') || 'localhost'
      const port = (config.get<string>('REDIS_PORT') || '6379').toString()
      const password = config.get<string>('REDIS_PASSWORD') || ''
      const namespace = config.get<string>('REDIS_NAMESPACE') || 'Akaiito'
      const encodedPassword = password ? encodeURIComponent(password) : ''
      const authPart = encodedPassword ? `:${encodedPassword}@` : ''
      const url = `redis://${authPart}${host}:${port}`

      const redisKeyv = new Keyv({ store: new KeyvRedis(url, { namespace }) })
      const key = `health:cache:redis:ping:${Math.random().toString(36).slice(2)}`
      await redisKeyv.set(key, 'pong', 10000)
      const value = await redisKeyv.get<string>(key)
      await redisKeyv.delete(key)
      if (value !== 'pong') {
        throw new Error('redis cache ping value mismatch')
      }
    } catch (error) {
      redisCacheStatus = 'not ok'
      errors.redisCache = String(error)
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
