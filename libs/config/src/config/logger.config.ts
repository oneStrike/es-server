import process from 'node:process'
import { registerAs } from '@nestjs/config'

const {
  LOG_LEVEL = 'info',
  LOG_PATH = './logs',
  LOG_MAX_SIZE = '20m',
  LOG_RETAIN_DAYS = '7d',
  LOG_COMPRESS = 'true',
  LOG_CONSOLE_LEVEL = 'info',
} = process.env

export const LoggerConfig = {
  level: LOG_LEVEL,
  path: LOG_PATH,
  maxSize: LOG_MAX_SIZE,
  retainDays: LOG_RETAIN_DAYS,
  compress: LOG_COMPRESS === 'true',
  consoleLevel: LOG_CONSOLE_LEVEL,
}
export const LoggerConfigRegister = registerAs('logger', () => LoggerConfig)
