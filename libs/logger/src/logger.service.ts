import type { Logger } from 'winston'
import type { LoggerConfig } from './types'
import fs from 'node:fs'
import path from 'node:path'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createLogger, format, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

/**
 * LoggerService - 简化的日志服务
 *
 * 提供一个默认的日志器实例，包含：
 * - 目录创建和管理
 * - 日志格式构建
 * - 环境配置管理
 */
@Injectable()
export class LoggerService {
  // 默认日志器实例
  private logger: Logger

  constructor(private readonly configService: ConfigService) {
    // 初始化默认日志器
    this.logger = createLogger(this.buildLoggerOptions())
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
  buildFormats(): { base: any, consoleFmt: any } {
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
   * 构建默认日志器配置
   * @returns Winston日志器配置选项
   */
  buildLoggerOptions() {
    const {
      level,
      path: rootPath,
      maxSize,
      retainDays,
      compress,
      consoleLevel,
    } = this.configService.get<LoggerConfig>('logger')!
    const logDir = path.join(rootPath, 'default')
    this.ensureDir(logDir)
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
        this.rotate(logDir, 'app', 'info', base, maxSize, retainDays, compress),
        this.rotate(
          logDir,
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
          logDir,
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
          logDir,
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
   * 获取默认日志器实例
   * @returns 默认日志器
   */
  getLogger(): Logger {
    return this.logger
  }
}
