import type { FastifyAdapter } from '@nestjs/platform-fastify'
import * as process from 'node:process'
import { prisma } from '@/prisma/prisma.connect'

/**
 * 配置健康检查端点
 * 用于 Docker/Kubernetes 存活和就绪探针
 */
export function setupHealthChecks(fastifyAdapter: FastifyAdapter) {
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
    try {
      // 检查数据库连接（PostgreSQL）
      await prisma.$queryRaw`SELECT 1`

      reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
        },
      })
    } catch (error) {
      reply.code(503).send({
        status: 'not ready',
        error: String(error),
        timestamp: new Date().toISOString(),
      })
    }
  })
}
