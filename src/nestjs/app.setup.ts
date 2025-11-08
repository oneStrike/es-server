import type {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import type { CustomLoggerService } from '@/common/module/logger/logger.service'
import * as process from 'node:process'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifyHelmet from '@fastify/helmet'

import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { AdminModule } from '@/modules/admin/admin.module'
import { ClientModule } from '@/modules/client/client.module'
import { setupCompression } from '@/nestjs/compression'
import { setupHealthChecks } from '@/nestjs/health'
import { setupMultipart } from '@/nestjs/multipart'
import { setupSwagger } from '@/nestjs/swagger'

/**
 * 配置应用的所有中间件和插件
 */
export async function setupApp(
  app: NestFastifyApplication,
  fastifyAdapter: FastifyAdapter,
): Promise<CustomLoggerService> {
  // 设置自定义日志服务
  const loggerFactory = app.get(LoggerFactoryService)
  const logger = loggerFactory.createGlobalLogger('Application')
  app.useLogger(logger)

  // 启用跨域
  app.enableCors()

  // 选择模块
  app.select(AdminModule)
  app.select(ClientModule)

  // 设置全局前缀
  app.setGlobalPrefix('api')

  // 配置响应压缩（gzip/brotli）
  await setupCompression(fastifyAdapter)

  // 配置健康检查端点（包含数据库与 Redis 缓存校验）
  setupHealthChecks(fastifyAdapter, app)

  // 配置文件上传
  await setupMultipart(fastifyAdapter, app)

  // 注册 CSRF 保护插件
  await app.register(fastifyCsrf as any)

  // 注册安全响应头（Helmet）
  await app.register(fastifyHelmet as any, {
    // 依据 API 服务特性开启常用安全策略
    contentSecurityPolicy: false, // 若无模板渲染，可禁用以减少开销
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xssFilter: true,
    hidePoweredBy: true,
  })

  // 配置 Swagger 文档（生产环境可条件性禁用）
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
    setupSwagger(app)
  }

  return logger
}
