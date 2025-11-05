import type { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CustomLoggerService } from '@/common/module/logger/logger.service'
import * as process from 'node:process'
import fastifyCsrf from '@fastify/csrf-protection'

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

  // 配置健康检查端点
  setupHealthChecks(fastifyAdapter)

  // 配置文件上传
  await setupMultipart(fastifyAdapter, app)

  // 注册 CSRF 保护插件
  await app.register(fastifyCsrf as any)

  // 配置 Swagger 文档（生产环境可条件性禁用）
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    await setupSwagger(app)
  }

  return logger
}
