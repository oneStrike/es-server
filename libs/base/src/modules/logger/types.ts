import type { LoggerLevel } from '@libs/base/constant'

export type { LoggerLevel } from '@libs/base/constant'

export interface LoggerConfig {
  level: LoggerLevel
  path: string
  maxSize: string
  retainDays: string
  compress: boolean
  consoleLevel: LoggerLevel
}
