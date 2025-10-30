import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as process from 'node:process'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'

import { AppModule } from '@/app.module'
import { logStartupInfo, setupApp, setupHotReload } from '@/nestjs'

async function bootstrap() {
  return async function startApp() {
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

    // 配置应用（中间件、插件、日志等）
    const logger = await setupApp(app, fastifyAdapter)

    // 启动应用
    const port = process.env.PORT ?? 3000
    await app.listen(port, '0.0.0.0') // 监听所有网络接口（Docker 容器必需）

    // 打印启动信息
    logStartupInfo(port, logger)

    // 配置热重载（开发环境）
    setupHotReload(app, logger)

    return app
  }
}

void bootstrap()
  .then(async (startApp) => {
    await startApp()
  })
  .catch((error) => {
    console.error('应用程序启动失败:', error)
    process.exit(1)
  })
