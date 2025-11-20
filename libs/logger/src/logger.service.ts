import type { Logger } from 'winston'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Injectable } from '@nestjs/common'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

/**
 * LoggerService - NestJS日志服务
 *
 * 提供统一的日志管理功能，包括：
 * - 目录创建和管理
 * - 日志格式构建
 * - 环境配置管理
 * - 各类日志器的创建和管理
 * - 根据API类型选择合适的日志器
 */
@Injectable()
export class LoggerService {
  // 日志器实例
  private systemLogger: Logger
  private adminLogger: Logger
  private clientLogger: Logger

  constructor() {
    // 初始化各类日志器
    this.systemLogger = createLogger(this.systemLoggerOptions())
    this.adminLogger = this.buildCategoryLogger('admin')
    this.clientLogger = this.buildCategoryLogger('client')
  }

  /**
   * 确保指定的目录存在，如果不存在则递归创建
   * @param dir 要确保存在的目录路径
   */
  ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * 构建日志格式化器
   * @returns 包含基础格式和控制台格式的对象
   */
  buildFormats(): { base: any; consoleFmt: any } {
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
  envConfig() {
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
  rotate(
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
  systemLoggerOptions() {
    const { level, rootPath, maxSize, retainDays, compress, consoleLevel } =
      this.envConfig()
    const systemDir = path.join(rootPath, 'system')
    this.ensureDir(systemDir)
    const { base, consoleFmt } = this.buildFormats()
    return {
      level,
      exitOnError: false,
      transports: [
        new transports.Console({
          level: consoleLevel,
          format: consoleFmt,
          handleExceptions: true,
        }),
        this.rotate(
          systemDir,
          'app',
          'info',
          base,
          maxSize,
          retainDays,
          compress,
        ),
        this.rotate(
          systemDir,
          'error',
          'error',
          base,
          maxSize,
          retainDays,
          compress,
        ),
      ],
      exceptionHandlers: [
        this.rotate(
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
        this.rotate(
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
  buildCategoryLogger(category: 'admin' | 'client'): Logger {
    const { level, rootPath, maxSize, retainDays, compress, consoleLevel } =
      this.envConfig()
    const dir = path.join(rootPath, category)
    this.ensureDir(dir)
    const { base, consoleFmt } = this.buildFormats()
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
        this.rotate(dir, 'app', 'info', base, maxSize, retainDays, compress),
        this.rotate(dir, 'error', 'error', base, maxSize, retainDays, compress),
      ],
      exceptionHandlers: [
        this.rotate(
          dir,
          'exceptions',
          'error',
          base,
          maxSize,
          retainDays,
          compress,
        ),
      ],
      rejectionHandlers: [
        this.rotate(
          dir,
          'rejections',
          'error',
          base,
          maxSize,
          retainDays,
          compress,
        ),
      ],
    })
  }

  /**
   * 创建自定义日志器
   * @param options 日志器选项
   * @returns Winston日志器实例
   */
  createCustomLogger(options: {
    level?: string
    defaultMeta?: Record<string, any>
    category?: string
    transports?: any[]
    exceptionHandlers?: any[]
    rejectionHandlers?: any[]
  }): Logger {
    const { level, rootPath, maxSize, retainDays, compress, consoleLevel } =
      this.envConfig()
    const { base, consoleFmt } = this.buildFormats()

    const config = {
      level: options.level || level,
      exitOnError: false,
      defaultMeta: {
        ...options.defaultMeta,
        ...(options.category && { category: options.category }),
      },
      transports: [
        new transports.Console({
          level: consoleLevel,
          format: consoleFmt,
          handleExceptions: true,
        }),
        ...(options.transports || []),
      ],
      exceptionHandlers: options.exceptionHandlers || [
        this.rotate(
          rootPath,
          'exceptions',
          'error',
          base,
          maxSize,
          retainDays,
          compress,
        ),
      ],
      rejectionHandlers: options.rejectionHandlers || [
        this.rotate(
          rootPath,
          'rejections',
          'error',
          base,
          maxSize,
          retainDays,
          compress,
        ),
      ],
    }

    return createLogger(config)
  }

  /**
   * 获取日志器配置说明
   * @returns 配置说明对象
   */
  getConfigDocumentation() {
    return {
      description: '日志系统环境变量配置说明',
      variables: {
        LOG_LEVEL: '日志级别（默认：production环境为info，开发环境为debug）',
        LOG_PATH: '日志文件存储路径（默认：项目logs目录）',
        LOG_MAX_SIZE: '单个日志文件最大大小（默认：50m）',
        LOG_RETAIN_DAYS: '日志文件保留天数（默认：30天）',
        LOG_COMPRESS: '是否压缩历史日志文件（默认：true）',
        LOG_CONSOLE_LEVEL: '控制台输出日志级别（默认：与LOG_LEVEL相同）',
      },
    }
  }

  /**
   * 根据API类型选择合适的日志器
   * @param apiType API类型（admin/client/system）
   * @returns 对应的日志器实例
   */
  pickLogger(apiType?: ApiTypeEnum): Logger {
    if (!apiType) {
      return this.systemLogger
    }
    switch (apiType) {
      case ApiTypeEnum.ADMIN:
        return this.adminLogger
      case ApiTypeEnum.CLIENT:
        return this.clientLogger
      case ApiTypeEnum.SYSTEM:
      case ApiTypeEnum.PUBLIC:
      default:
        return this.systemLogger
    }
  }

  /**
   * 获取系统日志器实例
   * @returns 系统日志器
   */
  getSystemLogger(): Logger {
    return this.systemLogger
  }

  /**
   * 获取管理员日志器实例
   * @returns 管理员日志器
   */
  getAdminLogger(): Logger {
    return this.adminLogger
  }

  /**
   * 获取客户端日志器实例
   * @returns 客户端日志器
   */
  getClientLogger(): Logger {
    return this.clientLogger
  }
}
