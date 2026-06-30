import type { FastifyAdapter } from '@nestjs/platform-fastify'

/** Fastify register 方法可接受的插件类型。 */
export type FastifyRegisterPlugin = Parameters<FastifyAdapter['register']>[0]
