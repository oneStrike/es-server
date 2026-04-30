import type { LoggerLevelEnum } from '../../constant/logger.constant'

/**
 * 日志等级枚举的模块内复用出口。
 */
export type { LoggerLevelEnum } from '../../constant/logger.constant'

/**
 * 日志模块运行配置。
 */
export interface LoggerConfig {
  level: LoggerLevelEnum
  path: string
  maxSize: string
  retainDays: string
  compress: boolean
  consoleLevel: LoggerLevelEnum
}
