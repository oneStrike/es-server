import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as process from 'node:process'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'

import { AppModule } from '@/app.module'
import { logStartupInfo, setupApp } from '@/nestjs'

// 为 Webpack HMR 声明模块类型，并在入口持有应用引用
declare const module: any
let appRef: NestFastifyApplication | null = null

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
    // 允许优雅关闭钩子，以便 Terminus 在关闭期间报告状态
    app.enableShutdownHooks()

    // 保存应用引用，供 HMR 释放资源时关闭
    appRef = app

    // 配置应用（中间件、插件、日志等）
    const logger = await setupApp(app, fastifyAdapter)

    // 启动应用
    const port = process.env.PORT ?? 8080
    await app.listen(port, '0.0.0.0') // 监听所有网络接口（Docker 容器必需）

    // 打印启动信息
    logStartupInfo(port, logger)
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

// 入口模块接受自身更新，并在替换时优雅关闭应用
if (process.env.NODE_ENV !== 'production' && module?.hot) {
  module.hot.accept()
  module.hot.dispose(async () => {
    try {
      if (appRef) {
        await appRef.close()
        appRef = null
        console.info('主入口已释放，等待应用热重载...')
      }
    } catch (e) {
      console.error('热重载关闭应用失败:', e)
    }
  })
}
