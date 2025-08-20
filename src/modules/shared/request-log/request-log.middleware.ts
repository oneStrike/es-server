import type { NestMiddleware } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { Injectable } from '@nestjs/common'
import { buildInitialContext, RequestContextStorage } from './request-context'

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const init = buildInitialContext(req)
    const startAt = Date.now()

    RequestContextStorage.run({ ...init, startAt }, () => {
      const rawRes: any = (res as any)?.raw ?? res
      const onFinish = () => {
        try {
          const statusCode: number | undefined =
            (res as any)?.statusCode ?? rawRes?.statusCode ?? undefined
          const elapsed = Date.now() - startAt
          RequestContextStorage.setResponse(statusCode, elapsed)
        } catch {
          // no-op
        } finally {
          try {
            rawRes.off
              ? rawRes.off('finish', onFinish)
              : rawRes.removeListener?.('finish', onFinish)
          } catch {
            // no-op
          }
        }
      }

      try {
        // Fastify 使用 raw Node res 的 finish 事件
        if (rawRes && typeof rawRes.on === 'function') {
          rawRes.on('finish', onFinish)
        }
      } catch {
        // no-op
      }

      next()
    })
  }
}
