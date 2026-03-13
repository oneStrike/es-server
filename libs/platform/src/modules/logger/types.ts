import type { LoggerLevel } from '@libs/platform/constant'

export type { LoggerLevel } from '@libs/platform/constant'

export interface LoggerConfig {
  level: LoggerLevel
  path: string
  maxSize: string
  retainDays: string
  compress: boolean
  consoleLevel: LoggerLevel
}
