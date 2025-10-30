import type { FastifyAdapter } from '@nestjs/platform-fastify'
import * as process from 'node:process'

/**
 * 配置健康检查端点
 * 用于 Docker/Kubernetes 存活和就绪探针
 */
export function setupHealthChecks(fastifyAdapter: FastifyAdapter) {
  // 存活检查端点（Liveness Probe）
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
      // TODO: 可扩展为检查数据库连接、Redis 连接等
      // const prisma = app.get(PrismaService)
      // await prisma.$queryRaw`SELECT 1`

      reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
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
