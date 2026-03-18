import type { LoggerLevelEnum } from '../../constant/logger.constant'

export type { LoggerLevelEnum } from '../../constant/logger.constant'

export interface LoggerConfig {
  level: LoggerLevelEnum
  path: string
  maxSize: string
  retainDays: string
  compress: boolean
  consoleLevel: LoggerLevelEnum
}
