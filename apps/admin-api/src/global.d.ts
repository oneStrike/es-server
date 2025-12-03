declare module 'fastify/fastify' {
  import type { JwtUserInfoInterface } from '@libs/base/types'

  interface FastifyRequest {
    user?: JwtUserInfoInterface
  }
}
