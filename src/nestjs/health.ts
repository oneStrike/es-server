import type { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
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
    let cacheStatus: 'ok' | 'not ok' = 'ok'
    const errors: Record<string, string> = {}

    try {
      await prisma.$queryRaw`SELECT 1`
    }
    catch (error) {
      dbStatus = 'not ok'
      errors.database = String(error)
    }

    // Redis 缓存健康检查（通过 CacheManager 读写）
    try {
      const cache = app.get<Cache>(CACHE_MANAGER)
      const key = 'health:cache:ping'
      await cache.set(key, 'pong', 10000)
      const value = await cache.get<string>(key)
      await cache.del(key)
      if (value !== 'pong') {
        throw new Error('cache ping value mismatch')
      }
    }
    catch (error) {
      cacheStatus = 'not ok'
      errors.cache = String(error)
    }

    const ready = dbStatus === 'ok' && cacheStatus === 'ok'
    reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not ready',
      timestamp,
      checks: {
        database: dbStatus,
        cache: cacheStatus,
      },
      ...(Object.keys(errors).length ? { errors } : {}),
    })
  })
}
