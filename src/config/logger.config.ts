import type { WinstonModuleOptions } from 'nest-winston'
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import * as process from 'node:process'
import * as winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
/**
 * 日志级别枚举
 * 按严重程度从高到低排序
 */
export enum LogLevel {
  ERROR = 'error', // 错误级别 - 记录严重错误，可能影响系统正常运行
  WARN = 'warn', // 警告级别 - 记录可能导致问题的异常情况
  INFO = 'info', // 信息级别 - 记录系统正常运行的关键信息
  DEBUG = 'debug', // 调试级别 - 记录详细的调试信息，通常仅开发环境使用
}

/**
 * 日志模块类型
 * 用于区分不同系统组件的日志来源
 */
export enum LogModule {
  ADMIN = 'admin', // 管理后台相关日志
  CLIENT = 'client', // 客户端相关日志
  GLOBAL = 'global', // 全局系统日志
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
 *
 * 将字符串环境变量解析为 LogLevel
 * @param value 输入的日志级别字符串
 * @param defaultLevel 当解析失败时返回的默认日志级别
 * @returns 标准化的日志级别枚举值
 */
function parseLogLevel(
  value: string | undefined,
  defaultLevel: LogLevel,
): LogLevel {
  // 转换为小写以支持大小写不敏感的解析
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
 * 获取日志配置
 * 从环境变量或默认值中获取日志系统配置
 */
function getLoggerConfig(): LoggerConfig {
  const {
    NODE_ENV,
    DOCKER,
    LOG_ENABLE_CONSOLE,
    LOG_ENABLE_FILE,
    LOG_CONSOLE_LEVEL,
    LOG_MAX_FILES,
    LOG_MAX_SIZE,
    LOG_DATE_PATTERN,
    APP_LOG_DIR,
    LOG_DIR,
  } = process.env

  // 环境检测
  const isDevelopment = NODE_ENV === 'development'
  const isDocker =
    process.cwd() === '/app' || existsSync('/.dockerenv') || DOCKER === 'true'

  // 定义默认配置
  const defaultConfig: LoggerConfig = {
    level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    enableConsole: isDevelopment,
    enableFile: true,
    enableColors: isDevelopment,
    consoleLevel: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
    maxFiles: '14d',
    maxSize: '20m',
    datePattern: 'YYYY-MM-DD',
    dirname: './logs',
  }

  // 从环境变量覆盖配置
  const config: LoggerConfig = {
    level: defaultConfig.level,
    enableConsole:
      LOG_ENABLE_CONSOLE !== undefined
        ? LOG_ENABLE_CONSOLE === 'true'
        : defaultConfig.enableConsole,
    enableFile: (() => {
      // 在容器中默认不写文件日志，除非显式开启 LOG_ENABLE_FILE=true
      if (isDocker) {
        return LOG_ENABLE_FILE === 'true'
      }
      // 非容器环境默认写文件日志，可通过 LOG_ENABLE_FILE 控制
      return LOG_ENABLE_FILE !== undefined
        ? LOG_ENABLE_FILE === 'true'
        : defaultConfig.enableFile
    })(),
    enableColors: defaultConfig.enableColors,
    consoleLevel: isDevelopment
      ? LogLevel.DEBUG
      : parseLogLevel(LOG_CONSOLE_LEVEL, defaultConfig.consoleLevel),
    maxFiles: LOG_MAX_FILES || defaultConfig.maxFiles,
    maxSize: LOG_MAX_SIZE || defaultConfig.maxSize,
    datePattern: LOG_DATE_PATTERN || defaultConfig.datePattern,
    dirname: (() => {
      if (isDocker) {
        // 在容器中固定使用挂载点，避免误用宿主机路径变量
        return '/app/logs'
      }
      const dir = APP_LOG_DIR || LOG_DIR || defaultConfig.dirname
      return isAbsolute(dir) ? dir : join(process.cwd(), dir)
    })(),
  }

  return config
}

/**
 * 格式化控制台日志输出
 * @param info Winston日志信息对象
 * @returns 格式化后的控制台日志字符串
 */
function formatConsoleLog(info: winston.Logform.TransformableInfo): string {
  const {
    timestamp,
    level,
    message,
    context,
    trace,
    requestId,
    userId,
    stack,
  } = info

  const contextStr = context ? `[${context}]` : ''
  const requestIdStr = requestId ? `[${requestId}]` : ''
  const userIdStr = userId ? `[User:${userId}]` : ''
  const traceValue = trace || stack
  const traceStr = traceValue ? `\n${traceValue}` : ''

  return `${timestamp} ${level} ${contextStr}${requestIdStr}${userIdStr} ${message}${traceStr}`
}

/**
 * 创建控制台日志传输器
 * @param config 日志配置对象
 * @returns 配置好的控制台传输器实例
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
      // 根据配置决定是否启用彩色输出
      config.enableColors
        ? winston.format.colorize()
        : winston.format.uncolorize(),
      winston.format.printf(formatConsoleLog),
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
      winston.format.printf(formatConsoleLog),
    ),
  })
}

/**
 * 格式化文件日志输出
 * @param info Winston日志信息对象
 * @param module 日志模块标识
 * @param logType 可选的日志类型标识
 * @returns 格式化后的JSON日志字符串
 */
function formatFileLog(
  info: winston.Logform.TransformableInfo,
  module: LogModule,
  logType?: string,
): string {
  const { timestamp, level, message, context, metadata, ...rest } = info

  // 构建结构化日志数据对象
  const logEntry: any = {
    timestamp,
    level,
    message,
    module,
  }

  // 添加日志类型（如果有）
  if (logType) {
    logEntry.type = logType
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
}

/**
 * 创建错误处理文件传输器
 * @param config 日志配置
 * @param module 日志模块
 * @param type 错误类型 (exceptions/rejections)
 * @param logType 日志类型标识
 */
function createErrorHandlerFileTransport(
  config: LoggerConfig,
  module: LogModule,
  type: 'exceptions' | 'rejections',
  logType: 'UNCAUGHT_EXCEPTION' | 'UNHANDLED_REJECTION',
): InstanceType<typeof DailyRotateFile> {
  return createBaseFileTransport(
    config,
    module,
    `${type}-%DATE%.log`,
    LogLevel.ERROR,
    logType,
  )
}

/**
 * 创建异常文件传输器（未处理异常）
 */
function createExceptionsFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return createErrorHandlerFileTransport(
    config,
    module,
    'exceptions',
    'UNCAUGHT_EXCEPTION',
  )
}

/**
 * 创建未处理Promise拒绝文件传输器
 */
function createRejectionsFileTransport(
  config: LoggerConfig,
  module: LogModule,
): InstanceType<typeof DailyRotateFile> {
  return createErrorHandlerFileTransport(
    config,
    module,
    'rejections',
    'UNHANDLED_REJECTION',
  )
}

/**
 * 创建通用文件日志传输器
 * 这是所有文件传输器的基础工厂函数，提供统一的文件日志配置逻辑
 *
 * @param config 日志配置对象
 * @param module 日志模块标识
 * @param filename 日志文件名模板
 * @param level 日志级别
 * @param logType 可选的日志类型标识，用于特殊类型日志
 * @param includeErrorStack 是否包含错误堆栈信息
 * @returns 配置好的DailyRotateFile传输器实例
 */
function createBaseFileTransport(
  config: LoggerConfig,
  module: LogModule,
  filename: string,
  level: LogLevel,
  logType?: string,
  includeErrorStack: boolean = true,
): InstanceType<typeof DailyRotateFile> {
  // 构建日志格式化选项数组
  const formatOptions = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ]

  // 条件性添加错误堆栈处理
  if (includeErrorStack) {
    formatOptions.push(winston.format.errors({ stack: true }))
  }

  // 添加JSON格式和自定义格式化
  formatOptions.push(
    winston.format.json(),
    winston.format.printf((info) => formatFileLog(info, module, logType)),
  )

  // 创建并返回文件传输器
  return new DailyRotateFile({
    level,
    filename: `${config.dirname}/${module}/${filename}`,
    datePattern: config.datePattern,
    maxSize: config.maxSize,
    maxFiles: config.maxFiles,
    format: winston.format.combine(...formatOptions),
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
  return createBaseFileTransport(config, module, `${level}-%DATE%.log`, level)
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
      winston.format.printf((info) => formatFileLog(info, module)),
    ),
  })
}

/**
 * 创建特定模块的Winston配置
 * @param module 日志模块标识，用于区分不同来源的日志
 * @returns 配置好的Winston模块选项
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
