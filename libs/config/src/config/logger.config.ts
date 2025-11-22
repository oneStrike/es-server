import process from 'node:process'
import { registerAs } from '@nestjs/config'

export const LoggerConfigRegister = registerAs('logger', () => {
  const {
    LOG_LEVEL,
    LOG_PATH,
    LOG_MAX_SIZE,
    LOG_RETAIN_DAYS,
    LOG_COMPRESS,
    LOG_CONSOLE_LEVEL,
  } = process.env
  return {
    level: LOG_LEVEL || 'info',
    path: LOG_PATH || './logs',
    maxSize: LOG_MAX_SIZE || '20m',
    retainDays: Number(LOG_RETAIN_DAYS) || 7,
    compress: LOG_COMPRESS === 'true',
    consoleLevel: LOG_CONSOLE_LEVEL || 'info',
  }
})
