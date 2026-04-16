import type { AppConfigInterface } from '@libs/platform/types'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { MessageNativeWebSocketServer } from '@libs/message/notification/notification-native-websocket.server';
import { setupApp } from '@libs/platform/bootstrap/app.setup';
import { logStartupInfo } from '@libs/platform/bootstrap/logStartupInfo';
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { IoAdapter } from '@nestjs/platform-socket.io'
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
    trustProxy: true,
  })

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      bufferLogs: true,
    },
  )
  app.enableShutdownHooks()

  const appConfig = app.get(ConfigService).get<AppConfigInterface>('app')!
  await setupApp(app, fastifyAdapter, appConfig)
  app.useWebSocketAdapter(new IoAdapter(app))

  await app.listen(appConfig.port, '0.0.0.0')
  app.get(MessageNativeWebSocketServer).attach(app.getHttpServer())
  logStartupInfo(appConfig.port, appConfig.swaggerConfig.path)

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(async () => {
      try {
        await app.close()
      } catch (error) {
        console.error('Failed to close app during HMR:', error)
      }
    })
  }
}

void bootstrap()
