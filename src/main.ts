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
  const fastifyAdapter = new FastifyAdapter()
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
  await app.register(fastifyCsrf)
  setupSwagger(app)

  await app.listen(process.env.PORT ?? 3000)

  // 打印访问地址（控制台显示）
  console.log(`🚀 应用程序已启动`)
  console.log(`📍 本地访问地址: http://localhost:${port}`)
  console.log(`📍 网络访问地址: http://127.0.0.1:${port}`)
  console.log(`📖 API 文档地址: http://localhost:${port}/api/docs`)
  console.log(`🔧 管理后台 API: http://localhost:${port}/api/admin`)
  console.log(`👥 客户端 API: http://localhost:${port}/api/client`)

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
