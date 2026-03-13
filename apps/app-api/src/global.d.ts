declare module 'fastify' {
  import type { JwtUserInfoInterface } from '@libs/platform/types'

  import type {
    FastifyRequest as BaseFastifyRequest,
    FastifyReply,
  } from 'fastify/fastify'

  interface FastifyRequest extends BaseFastifyRequest {
    user?: JwtUserInfoInterface
  }

  // 确保 FastifyReply 也被正确导出
  export type { FastifyReply }
  export type { FastifyRequest }
}
