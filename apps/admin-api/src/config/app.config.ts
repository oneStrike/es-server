import process from 'node:process'
import { registerAs } from '@nestjs/config'

export const AppConfigRegister = registerAs('app', () => {
  const { APP_NAME, APP_PORT, APP_VERSION } =
    process.env
  return {
    name: APP_NAME || 'admin-api',
    version: APP_VERSION || '1.0.0',
    port: Number(APP_PORT) || 8080,
  }
})
