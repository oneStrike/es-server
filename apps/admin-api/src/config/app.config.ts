import process from 'node:process'
import { registerAs } from '@nestjs/config'

export interface AppConfigInterface {
  name: string
  version: string
  port: number
  fileUrlPrefix: string
}

export const AppConfigRegister = registerAs('app', () => {
  const {
    APP_NAME = 'admin-api',
    APP_PORT = '8080',
    APP_VERSION = '1.0.0',
    APP_FILE_URL_PREFIX = '/files/',
  } = process.env
  return {
    name: APP_NAME,
    version: APP_VERSION,
    port: Number(APP_PORT),
    fileUrlPrefix: APP_FILE_URL_PREFIX,
  }
})
