declare module 'fastify' {
  import type {
    FastifyRequest as BaseFastifyRequest,
    FastifyReply,
  } from 'fastify/fastify'

  interface FastifyRequest extends BaseFastifyRequest {}

  export type { FastifyReply }
  export type { FastifyRequest }
}
