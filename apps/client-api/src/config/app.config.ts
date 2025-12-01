import type { AppConfigInterface } from '@libs/base/types'
import process from 'node:process'
import { isDevelopment } from '@libs/base/utils'
import { registerAs } from '@nestjs/config'

export const AppConfigRegister = registerAs('app', (): AppConfigInterface => {
  const {
    APP_NAME = 'client-api',
    APP_PORT = '8080',
    APP_VERSION = '1.0.0',
    APP_FILE_URL_PREFIX = '/files/',
  } = process.env
  return {
    name: APP_NAME,
    version: APP_VERSION,
    port: Number(APP_PORT),
    globalApiPrefix: 'api',
    fileUrlPrefix: APP_FILE_URL_PREFIX,
    swaggerConfig: {
      enable: isDevelopment(),
      title: '客户端API文档',
      description: '客户端API文档',
      version: APP_VERSION,
      path: 'api-doc',
    },
  }
})
