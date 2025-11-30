import type { AppConfigInterface } from '@libs/base/types'
import process from 'node:process'
import { isDevelopment } from '@libs/base/utils'
import { registerAs } from '@nestjs/config'

export const AppConfigRegister = registerAs('app', (): AppConfigInterface => {
  const {
    APP_NAME = 'admin-api',
    APP_PORT = '8080',
    APP_VERSION = '1.0.0',
    APP_FILE_URL_PREFIX = '/files/',
    APP_DEFAULT_PASSWORD = 'Aa@123456',
  } = process.env
  return {
    name: APP_NAME,
    version: APP_VERSION,
    port: Number(APP_PORT),
    globalApiPrefix: 'api',
    fileUrlPrefix: APP_FILE_URL_PREFIX,
    defaultPassword: APP_DEFAULT_PASSWORD,
    swaggerConfig: {
      enable: isDevelopment(),
      title: 'ES后台管理系统',
      description: 'ES后台管理系统API文档',
      version: APP_VERSION,
      path: 'api-doc',
    },
  }
})
