import type { WinstonModuleOptions } from 'nest-winston'
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import * as process from 'node:process'
import * as winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * 日志模块类型
 */
export enum LogModule {
  ADMIN = 'admin',
  CLIENT = 'client',
  GLOBAL = 'global',
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  enableColors: boolean
  consoleLevel: LogLevel
  maxFiles: string
  maxSize: string
  datePattern: string
  dirname: string
}

/**
 * 将字符串环境变量解析为 LogLevel
 */
function parseLogLevel(
  value: string | undefined,
  defaultLevel: LogLevel,
): LogLevel {
  switch ((value || '').toLowerCase()) {
    case 'error':
      return LogLevel.ERROR
    case 'warn':
      return LogLevel.WARN
    case 'info':
      return LogLevel.INFO
    case 'debug':
      return LogLevel.DEBUG
    default:
      return defaultLevel
  }
}

/**
 * 获取环境变量配置
 */
function getLoggerConfig(): LoggerConfig {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isDocker =
    process.cwd() === '/app' ||
    existsSync('/.dockerenv') ||
    process.env.DOCKER === 'true'

  return {
    level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    // 生产采用方案B：支持控制台输出，默认仅警告及以上
    // 可通过 LOG_ENABLE_CONSOLE 控制启用与否
    enableConsole: isDevelopment || process.env.LOG_ENABLE_CONSOLE === 'true',
    enableFile: (() => {
      // 在容器中默认不写文件日志，除非显式开启 LOG_ENABLE_FILE=true
      if (isDocker) {
        return process.env.LOG_ENABLE_FILE === 'true'
      }
      // 非容器环境默认写文件日志，可通过 LOG_ENABLE_FILE 控制
      return process.env.LOG_ENABLE_FILE
        ? process.env.LOG_ENABLE_FILE === 'true'
        : true
    })(),
    enableColors: isDevelopment,
    consoleLevel: isDevelopment
      ? LogLevel.DEBUG
      : parseLogLevel(process.env.LOG_CONSOLE_LEVEL, LogLevel.WARN),
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    dirname: (() => {
      if (isDocker) {
        // 在容器中固定使用挂载点，避免误用宿主机路径变量
        return '/app/logs'
      }
      const dir = process.env.APP_LOG_DIR || process.env.LOG_DIR || './logs'
      return isAbsolute(dir) ? dir : join(process.cwd(), dir)
    })(),
  }
}

/**
 * 创建控制台传输器
 */
function createConsoleTransport(
  config: LoggerConfig,
): winston.transports.ConsoleTransportInstance {
  return new winston.transports.Console({
    level: config.consoleLevel,
    // 将 warn/error 发送到 stderr，便于 PM2 收集到 error_file
    stderrLevels: ['error', 'warn'],
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      config.enableColors
        ? winston.format.colorize()
        : winston.format.uncolorize(),
      winston.format.printf((info) => {
        const {
          timestamp,
          level,
          message,
          context,
          trace,
          requestId,
          userId,
          stack,
          metadata,
        } = info as any

        const contextStr = context ? `[${context}]` : ''
        const requestIdStr = requestId ? `[${requestId}]` : ''
        const userIdStr = userId ? `[User:${userId}]` : ''
        const traceValue = trace || stack || metadata?.trace || metadata?.stack
        const traceStr = traceValue ? `\n${traceValue}` : ''

        return `${timestamp} ${level} ${contextStr}${requestIdStr}${userIdStr} ${message}${traceStr}`
      }),
    ),
  })
}

/**
 * 创建控制台异常处理传输器（未处理异常）
 */
function createConsoleExceptionTransport(
  config: LoggerConfig,
): winston.transports.ConsoleTransportInstance {
  return new winston.transports.Console({
    level: LogLevel.ERROR,
    stderrLevels: ['error'],
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      config.enableColors
        ? winston.format.colorize()
        : winston.format.uncolorize(),
      winston.format.printf((info) => {
        const {
          timestamp,
          level,
          message,
          context,
          trace,
          requestId,
          userId,
          stack,
          metadata,
        } = info as any

        const contextStr = context ? `[${context}]` : ''
        const requestIdStr = requestId ? `[${requestId}]` : ''
        const userIdStr = userId ? `[User:${userId}]` : ''
        const traceValue = trace || stack || metadata?.trace || metadata?.stack
        const traceStr = traceValue ? `\n${traceValue}` : ''

        return `${timestamp} ${level} ${contextStr}${requestIdStr}${userIdStr} ${message}${traceStr}`
      }),
    ),
  })
}

/**
 * 创建异常文件传输器（未处理异常）
 */
function createExceptionsFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return new DailyRotateFile({
    level: LogLevel.ERROR,
    filename: `${config.dirname}/${module}/exceptions-%DATE%.log`,
    datePattern: config.datePattern,
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const { timestamp, level, message, context, metadata, ...rest } = info

        const logEntry: any = {
          timestamp,
          level,
          message,
          module,
          type: 'UNCAUGHT_EXCEPTION',
        }

        if (context) {
          logEntry.context = context
        }
        if (metadata) {
          Object.assign(logEntry, metadata)
        }
        Object.assign(logEntry, rest)

        return JSON.stringify(logEntry)
      }),
    ),
  })
}

/**
 * 创建未处理Promise拒绝文件传输器
 */
function createRejectionsFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return new DailyRotateFile({
    level: LogLevel.ERROR,
    filename: `${config.dirname}/${module}/rejections-%DATE%.log`,
    datePattern: config.datePattern,
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const { timestamp, level, message, context, metadata, ...rest } = info

        const logEntry: any = {
          timestamp,
          level,
          message,
          module,
          type: 'UNHANDLED_REJECTION',
        }

        if (context) {
          logEntry.context = context
        }
        if (metadata) {
          Object.assign(logEntry, metadata)
        }
        Object.assign(logEntry, rest)

        return JSON.stringify(logEntry)
      }),
    ),
  })
}

/**
 * 创建文件传输器
 */
function createFileTransport(
  config: LoggerConfig,
  module: LogModule,
  level: LogLevel = config.level,
): InstanceType<typeof DailyRotateFile> {
  return new DailyRotateFile({
    level,
    filename: `${config.dirname}/${module}/${level}-%DATE%.log`,
    datePattern: config.datePattern,
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      // 自定义格式化：将所有元数据合并到一个JSON对象中
      winston.format.printf((info) => {
        const { timestamp, level, message, context, metadata, ...rest } = info

        const logEntry: any = {
          timestamp,
          level,
          message,
          module,
        }

        // 添加上下文信息
        if (context) {
          logEntry.context = context
        }

        // 合并metadata中的所有字段
        if (metadata) {
          Object.assign(logEntry, metadata)
        }

        // 合并其他字段
        Object.assign(logEntry, rest)

        return JSON.stringify(logEntry)
      }),
    ),
  })
}

/**
 * 创建错误文件传输器
 */
function createErrorFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return createFileTransport(config, module, LogLevel.ERROR)
}

/**
 * 创建组合文件传输器
 */
function createCombinedFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return new DailyRotateFile({
    level: config.level,
    filename: `${config.dirname}/${module}/combined-%DATE%.log`,
    datePattern: config.datePattern,
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      // 自定义格式化：将所有元数据合并到一个JSON对象中
      winston.format.printf((info) => {
        const { timestamp, level, message, context, metadata, ...rest } = info

        const logEntry: any = {
          timestamp,
          level,
          message,
          module,
        }

        // 添加上下文信息
        if (context) {
          logEntry.context = context
        }

        // 合并metadata中的所有字段
        if (metadata) {
          Object.assign(logEntry, metadata)
        }

        // 合并其他字段
        Object.assign(logEntry, rest)

        return JSON.stringify(logEntry)
      }),
    ),
  })
}

/**
 * 创建特定模块的Winston配置
 */
export function createWinstonConfig(module: LogModule): WinstonModuleOptions {
  const config = getLoggerConfig()
  const transports: winston.transport[] = []
  const exceptionHandlers: winston.transport[] = []
  const rejectionHandlers: winston.transport[] = []

  // 添加控制台传输器（仅开发环境）
  if (config.enableConsole) {
    transports.push(createConsoleTransport(config))
    // 仅在全局日志器上注册未处理异常/拒绝的控制台输出，避免重复
    if (module === LogModule.GLOBAL) {
      exceptionHandlers.push(createConsoleExceptionTransport(config))
      rejectionHandlers.push(createConsoleExceptionTransport(config))
    }
  }

  // 添加文件传输器
  if (config.enableFile) {
    transports.push(
      createCombinedFileTransport(config, module),
      createErrorFileTransport(config, module),
    )
    // 仅在全局日志器上注册未处理异常/拒绝的文件输出，避免重复
    if (module === LogModule.GLOBAL) {
      exceptionHandlers.push(createExceptionsFileTransport(config, module))
      rejectionHandlers.push(createRejectionsFileTransport(config, module))
    }
  }

  return {
    level: config.level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      // 保留常用字段在顶层，避免被移动到metadata中，方便控制台printf访问
      winston.format.metadata({
        fillExcept: [
          'message',
          'level',
          'timestamp',
          'trace',
          'context',
          'module',
          'requestId',
          'userId',
        ],
      }),
    ),
    transports,
    exceptionHandlers,
    rejectionHandlers,
    // 生产环境可以添加远程日志传输器
    ...(process.env.NODE_ENV === 'production' &&
      {
        // 示例：Sentry集成
        // transports: [...transports, new SentryTransport()]
      }),
  }
}

/**
 * 默认全局日志配置
 */
export const globalLoggerConfig = createWinstonConfig(LogModule.GLOBAL)

/**
 * Admin模块日志配置
 */
export const adminLoggerConfig = createWinstonConfig(LogModule.ADMIN)

/**
 * Client模块日志配置
 */
export const clientLoggerConfig = createWinstonConfig(LogModule.CLIENT)
