import type { AppConfigInterface } from '@libs/platform/types'
import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import fastifyHelmet from '@fastify/helmet'
import { isDevelopment } from '@libs/platform/utils/env'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { setupCompression } from './compression'
import { setupMultipart } from './multipart'
import { setupSwagger } from './swagger'

/**
 * 配置 NestJS 应用的中间件、插件与全局设置
 *
 * 按顺序完成：日志、路由前缀、favicon、压缩、上传、安全头、Swagger 文档等初始化。
 * 所有配置项通过 AppConfigInterface 传入，支持多环境差异化配置。
 *
 * @param app - NestJS Fastify 应用实例
 * @param fastifyAdapter - Fastify 适配器实例，用于注册底层 Fastify 插件
 * @param config - 应用配置对象，包含路由前缀、Swagger 开关等
 */
export async function setupApp(
  app: NestFastifyApplication,
  fastifyAdapter: FastifyAdapter,
  config: AppConfigInterface,
) {
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  app.setGlobalPrefix(config.globalApiPrefix)

  if (isDevelopment()) {
    app.enableCors({
      origin: true,
      credentials: true,
    })
  }

  const fastifyInstance = fastifyAdapter.getInstance()

  fastifyInstance.get('/favicon.ico', async (_req, reply) => {
    reply.type('image/x-icon').code(204).send()
  })

  // 兼容客户端 POST 请求未携带 Content-Type 或 Content-Type 不标准的情况
  // 避免无 Body 的 POST 接口（如签到）因 Fastify content type 解析失败而返回 415
  fastifyInstance.addContentTypeParser('*', (request, payload, done) => {
    done(null, payload)
  })

  await setupCompression(fastifyAdapter)

  await setupMultipart(fastifyAdapter, app)

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xssFilter: true,
    hidePoweredBy: true,
  })

  if (isDevelopment() || config.swaggerConfig.enable) {
    setupSwagger(app, config.swaggerConfig)
  }
}
