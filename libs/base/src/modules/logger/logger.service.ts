import type { Logger } from 'winston'
import type { LoggerConfig } from './types'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClsService } from 'nestjs-cls'
import { createLogger, format, transports } from 'winston'

/**
 * LoggerService - 简化的日志服务
 *
 * 提供一个默认的日志器实例，包含：
 * - 自动集成 CLS Trace ID
 * - 仅输出到标准输出 (Stdout)
 * - 环境配置管理
 */
@Injectable()
export class LoggerService {
  // 默认日志器实例
  private logger: Logger

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly clsService: ClsService,
  ) {
    // 初始化默认日志器
    this.logger = createLogger(this.buildLoggerOptions())
  }

  /**
   * 构建日志格式化器
   * @returns 包含基础格式和控制台格式的对象
   */
  buildFormats(): { consoleFmt: any, jsonFmt: any } {
    // 基础格式：添加 Request ID
    const addRequestId = format((info) => {
      const requestId = this.clsService.getId()
      if (requestId) {
        info.requestId = requestId
      }
      return info
    })

    const consoleBase = format.combine(
      addRequestId(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.printf(({ timestamp, level, message, context, stack, requestId }) => {
        const ctx = context ? `[${context}] ` : ''
        const reqId = requestId ? `[${requestId}] ` : ''
        const msg =
          typeof message === 'string' ? message : JSON.stringify(message)
        const s = stack ? `\n${stack}` : ''
        return `${timestamp} ${level} ${reqId}${ctx}${msg}${s}`
      }),
    )
    const consoleFmt = format.combine(format.colorize(), consoleBase)

    const orderJsonFields = format((info) => {
      const {
        timestamp,
        level,
        message,
        requestId,
        context,
        stack,
        metadata,
        ...rest
      } = info
      return {
        timestamp,
        level,
        message,
        requestId,
        context,
        stack,
        metadata,
        ...rest,
      }
    })

    const jsonFmt = format.combine(
      addRequestId(),
      format.timestamp(),
      format.errors({ stack: true }),
      format.metadata({ fillExcept: ['timestamp', 'level', 'message'] }),
      orderJsonFields(),
      format.json(),
    )
    return { consoleFmt, jsonFmt }
  }

  /**
   * 构建默认日志器配置
   * @returns Winston日志器配置选项
   */
  buildLoggerOptions() {
    const conf = this.configService.get<LoggerConfig>('logger')!
    const level = conf.level
    const consoleLevel = conf.consoleLevel || level

    const { consoleFmt, jsonFmt } = this.buildFormats()
    const isDev = this.configService.get('NODE_ENV') !== 'production'

    return {
      level,
      exitOnError: false,
      transports: [
        new transports.Console({
          level: consoleLevel,
          format: isDev ? consoleFmt : jsonFmt, // 开发环境用彩色文本，生产环境用 JSON
          handleExceptions: true,
        }),
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

  getLoggerWithContext(context: string): Logger {
    return this.logger.child({ context })
  }
}
