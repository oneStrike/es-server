import type { AppConfigInterface } from '@libs/base/types'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { logStartupInfo, setupApp } from '@libs/base'

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

// 为 Webpack HMR 声明模块类型，并在入口持有应用引用
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
  // 允许优雅关闭钩子，以便 Terminus 在关闭期间报告状态
  app.enableShutdownHooks()

  const appConfig = app.get(ConfigService).get<AppConfigInterface>('app')!
  // 配置应用（中间件、插件、日志等）
  await setupApp(app, fastifyAdapter, appConfig)

  await app.listen(appConfig.port, '0.0.0.0') // 监听所有网络接口（Docker 容器必需）

  // 打印启动信息
  logStartupInfo(appConfig.port, appConfig.swaggerConfig.path)
  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(async () => {
      // 关闭应用
      await app.close()
    })
  }
}

void bootstrap()
