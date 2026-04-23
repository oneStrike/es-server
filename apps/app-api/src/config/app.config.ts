import type { AppConfigInterface } from '@libs/platform/types'
import process from 'node:process'
import { isDevelopment } from '@libs/platform/utils/env';
import { registerAs } from '@nestjs/config'

export const AppConfigRegister = registerAs('app', (): AppConfigInterface => {
  const {
    APP_NAME = 'app-api',
    APP_API_PORT,
    APP_PORT,
    APP_VERSION = '1.0.0',
  } = process.env
  return {
    name: APP_NAME,
    version: APP_VERSION,
    port: Number(APP_API_PORT ?? APP_PORT ?? '8081'),
    globalApiPrefix: 'api',
    swaggerConfig: {
      enable: isDevelopment(),
      title: '客户端API文档',
      description: '客户端API文档',
      version: APP_VERSION,
      path: 'api-doc',
    },
  }
})
