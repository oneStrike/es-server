import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import process from 'node:process'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { ClientApiModule } from './client-api.module'

declare const module: any

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({ trustProxy: true })
  const app = await NestFactory.create<NestFastifyApplication>(
    ClientApiModule,
    fastifyAdapter,
  )
  await app.listen(process.env.APP_PORT ?? process.env.PORT ?? 3001, '0.0.0.0')
  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(async () => app.close())
  }
}
void bootstrap()
