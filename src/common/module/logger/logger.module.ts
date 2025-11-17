import type { Logger } from 'winston'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Global, Module } from '@nestjs/common'
import { WINSTON_MODULE_PROVIDER, WinstonModule } from 'nest-winston'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

/**
 * 确保指定的目录存在，如果不存在则递归创建
 * @param dir 要确保存在的目录路径
 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * 构建日志格式化器
 * @returns 包含基础格式和控制台格式的对象
 */
function buildFormats() {
  const base = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, context, stack }) => {
      const ctx = context ? `[${context}] ` : ''
      const msg =
        typeof message === 'string' ? message : JSON.stringify(message)
      const s = stack ? `\n${stack}` : ''
      return `${timestamp} ${level} ${ctx}${msg}${s}`
    }),
  )
  const consoleFmt = format.combine(format.colorize(), base)
  return { base, consoleFmt }
}

/**
 * 从环境变量获取日志配置
 * @returns 日志配置对象
 */
function envConfig() {
  const isProd = process.env.NODE_ENV === 'production'
  const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')
  const rootPath = process.env.LOG_PATH || path.resolve(process.cwd(), 'logs')
  const maxSize = process.env.LOG_MAX_SIZE || '50m'
  const retainDays = process.env.LOG_RETAIN_DAYS || '30d'
  const compress = String(process.env.LOG_COMPRESS || 'true') === 'true'
  const consoleLevel = process.env.LOG_CONSOLE_LEVEL || level
  return {
    isProd,
    level,
    rootPath,
    maxSize,
    retainDays,
    compress,
    consoleLevel,
  }
}

/**
 * 创建按日期轮转的文件传输器
 * @param dir 日志文件目录
 * @param baseName 日志文件基础名称
 * @param level 日志级别
 * @param fmt 格式化器
 * @param maxSize 单个文件最大大小
 * @param retainDays 保留天数
 * @param zipped 是否压缩历史文件
 * @returns DailyRotateFile传输器实例
 */
function rotate(
  dir: string,
  baseName: string,
  level: string,
  fmt: any,
  maxSize: string,
  retainDays: string,
  zipped: boolean,
) {
  return new DailyRotateFile({
    filename: path.join(dir, `${baseName}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: zipped,
    maxSize,
    maxFiles: retainDays,
    level,
    format: fmt,
    handleExceptions: true,
  })
}

/**
 * 构建系统级日志器配置
 * @returns Winston日志器配置选项
 */
function systemLoggerOptions() {
  const { level, rootPath, maxSize, retainDays, compress, consoleLevel } =
    envConfig()
  const systemDir = path.join(rootPath, 'system')
  ensureDir(systemDir)
  const { base, consoleFmt } = buildFormats()
  return {
    level,
    exitOnError: false,
    transports: [
      new transports.Console({
        level: consoleLevel,
        format: consoleFmt,
        handleExceptions: true,
      }),
      rotate(systemDir, 'app', 'info', base, maxSize, retainDays, compress),
      rotate(systemDir, 'error', 'error', base, maxSize, retainDays, compress),
    ],
    exceptionHandlers: [
      rotate(
        systemDir,
        'exceptions',
        'error',
        base,
        maxSize,
        retainDays,
        compress,
      ),
    ],
    rejectionHandlers: [
      rotate(
        systemDir,
        'rejections',
        'error',
        base,
        maxSize,
        retainDays,
        compress,
      ),
    ],
  }
}

/**
 * 构建分类日志器（管理员或客户端）
 * @param category 日志类别（admin或client）
 * @returns Winston日志器实例
 */
function buildCategoryLogger(category: 'admin' | 'client') {
  const { level, rootPath, maxSize, retainDays, compress, consoleLevel } =
    envConfig()
  const dir = path.join(rootPath, category)
  ensureDir(dir)
  const { base, consoleFmt } = buildFormats()
  return createLogger({
    level,
    defaultMeta: { category },
    exitOnError: false,
    transports: [
      new transports.Console({
        level: consoleLevel,
        format: consoleFmt,
        handleExceptions: true,
      }),
      rotate(dir, 'app', 'info', base, maxSize, retainDays, compress),
      rotate(dir, 'error', 'error', base, maxSize, retainDays, compress),
    ],
    exceptionHandlers: [
      rotate(dir, 'exceptions', 'error', base, maxSize, retainDays, compress),
    ],
    rejectionHandlers: [
      rotate(dir, 'rejections', 'error', base, maxSize, retainDays, compress),
    ],
  })
}

/**
 * 全局日志模块
 * 提供三种类型的日志器：
 * - SYSTEM_LOGGER: 系统级日志，记录应用整体运行状态
 * - ADMIN_LOGGER: 管理员操作日志
 * - CLIENT_LOGGER: 客户端操作日志
 *
 * 环境变量配置说明：
 * - LOG_LEVEL: 日志级别（默认：production环境为info，开发环境为debug）
 * - LOG_PATH: 日志文件存储路径（默认：项目logs目录）
 * - LOG_MAX_SIZE: 单个日志文件最大大小（默认：50m）
 * - LOG_RETAIN_DAYS: 日志文件保留天数（默认：30天）
 * - LOG_COMPRESS: 是否压缩历史日志文件（默认：true）
 * - LOG_CONSOLE_LEVEL: 控制台输出日志级别（默认：与LOG_LEVEL相同）
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: () => systemLoggerOptions(),
    }),
  ],
  providers: [
    {
      provide: 'SYSTEM_LOGGER',
      useFactory: (root: Logger) => root,
      inject: [WINSTON_MODULE_PROVIDER],
    },
    {
      provide: 'ADMIN_LOGGER',
      useFactory: () => buildCategoryLogger('admin'),
    },
    {
      provide: 'CLIENT_LOGGER',
      useFactory: () => buildCategoryLogger('client'),
    },
  ],
  exports: ['SYSTEM_LOGGER', 'ADMIN_LOGGER', 'CLIENT_LOGGER'],
})
export class LoggerModule {}
