export enum LoggerLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LoggerConfig {
  level: LoggerLevel
  path: string
  maxSize: string
  retainDays: string
  compress: boolean
  consoleLevel: LoggerLevel
}
