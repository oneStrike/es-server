import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as process from 'node:process'
import fastifyCsrf from '@fastify/csrf-protection'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'

import { AppModule } from '@/app.module'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { AdminModule } from '@/modules/admin/admin.module'
import { ClientModule } from '@/modules/client/client.module'
import { setupMultipart } from '@/nestjs/multipart'
import { setupSwagger } from '@/nestjs/swagger'

declare const module: any

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    trustProxy: true, // 启用代理信任，用于正确解析 X-Forwarded-For 头部
  })
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      bufferLogs: true, // 缓冲日志，等待自定义logger初始化
    },
  )

  // 设置自定义日志服务
  const loggerFactory = app.get(LoggerFactoryService)
  const logger = loggerFactory.createGlobalLogger('Application')
  app.useLogger(logger)
  app.enableCors()

  app.select(AdminModule)
  app.select(ClientModule)

  app.setGlobalPrefix('api')

  await setupMultipart(fastifyAdapter, app)
  // 注册 CSRF 保护插件（使用 any 类型断言解决类型不兼容问题）
  await app.register(fastifyCsrf as any)
  setupSwagger(app)

  const port = process.env.PORT ?? 3000
  await app.listen(port)

  // 打印访问地址（控制台显示）
  logger.info(`🚀 应用程序已启动`)
  logger.info(`📍 本地访问地址: http://localhost:${port}`)
  logger.info(`📍 网络访问地址: http://127.0.0.1:${port}`)
  logger.info(`📖 API 文档地址: http://localhost:${port}/api/docs`)
  logger.info(`🔧 管理后台 API: http://localhost:${port}/api/admin`)
  logger.info(`👥 客户端 API: http://localhost:${port}/api/client`)

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(async () => {
      logger.info('应用程序正在热重载...')
      await app.close()
    })
  }
}

bootstrap().catch((error) => {
  console.error('应用程序启动失败:', error)
  process.exit(1)
})
