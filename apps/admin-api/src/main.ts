import type { AppConfigInterface } from '@libs/platform/types'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { setupApp } from '@libs/platform/bootstrap/app.setup';
import { logStartupInfo } from '@libs/platform/bootstrap/logStartupInfo';
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

interface HotModule {
  accept: () => void
  dispose: (callback: () => void | Promise<void>) => void
}

declare const module: {
  hot?: HotModule
}

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

  await app.listen(appConfig.port, '0.0.0.0')

  // 打印启动信息
  logStartupInfo(appConfig.port, appConfig.swaggerConfig.path)
  // Webpack HMR 支持
  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(async () => {
      // 修复：添加错误处理，避免热重载卡住
      try {
        await app.close()
      } catch (error) {
        console.error('热重载关闭应用时出错:', error)
      }
    })
  }
}

void bootstrap()
