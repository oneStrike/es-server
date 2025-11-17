/* eslint-disable */
import type { FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user?: any
    /**
     * 请求开始时间（毫秒级时间戳）
     */
    _startTime?: number
  }
}
