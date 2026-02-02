import process from 'node:process'
import { isProduction } from '@libs/base/utils'
import { registerAs } from '@nestjs/config'

const {
  LOG_LEVEL = isProduction() ? 'warn' : 'info',
  LOG_CONSOLE_LEVEL = isProduction() ? 'warn' : 'info',
} = process.env

export const LoggerConfig = {
  level: LOG_LEVEL,
  consoleLevel: LOG_CONSOLE_LEVEL,
}
export const LoggerConfigRegister = registerAs('logger', () => LoggerConfig)
