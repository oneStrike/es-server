import type { Logger } from 'winston'
import type { LoggerConfig } from './logger.type'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ClsService } from 'nestjs-cls'
import { createLogger, format, transports } from 'winston'

const REDACTED = '[REDACTED]'
const DATABASE_ERROR_REDACTED = '[DATABASE_ERROR]'
const DATABASE_URI_REDACTED = '[DATABASE_URI]'
const MAX_REDACTION_DEPTH = 6
const SAFE_ERROR_NAME_PATTERN = /^[a-z][\w.-]{0,63}$/i
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|credential|connection|databaseUrl|dsn|query|params|parameter|detail|authorization|cookie|api[-_]?key|private[-_]?key/i
const POSTGRES_URI_PATTERN = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi
const CREDENTIAL_AUTHORITY_PATTERN = /\/\/[^/\s:@]+:[^@\s/]+@/g
const SENSITIVE_ASSIGNMENT_PATTERN =
  /(?:password|passwd|token|secret|credential|connectionString|databaseUrl|query|params|parameter|detail)[:=][^\s&,;]+/gi

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

  // 构建日志格式化器
  buildFormats(): {
    consoleFmt: ReturnType<typeof format.combine>
    jsonFmt: ReturnType<typeof format.combine>
  } {
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
      format.printf(
        ({ timestamp, level, message, context, stack, requestId, ...rest }) => {
          const ctx = context ? `[${context}] ` : ''
          const reqId = requestId ? `[${requestId}] ` : ''
          const sanitizedMessage = sanitizeLogValue(message)
          const msg =
            typeof sanitizedMessage === 'string'
              ? sanitizedMessage
              : JSON.stringify(sanitizedMessage)
          const sanitizedStack = sanitizeStack(stack)
          const sanitizedRest = sanitizeLogValue(rest)
          const meta =
            isPlainRecord(sanitizedRest) && Object.keys(sanitizedRest).length
              ? ` ${JSON.stringify(sanitizedRest)}`
              : ''
          const s = sanitizedStack.length
            ? `\n${sanitizedStack.join('\n')}`
            : ''
          return `${timestamp} ${level} ${reqId}${ctx}${msg}${meta}${s}`
        },
      ),
    )
    const consoleFmt = format.combine(format.colorize(), consoleBase)

    const jsonFmt = format.combine(
      addRequestId(),
      format.timestamp(),
      format.errors({ stack: true }),
      format((info) => {
        const {
          timestamp,
          level,
          message,
          requestId,
          context,
          stack,
          ...rest
        } = info
        const sanitizedRest = sanitizeLogRecord(rest)
        return {
          timestamp,
          level,
          message: sanitizeLogValue(message),
          requestId,
          context,
          stack: sanitizeStack(stack),
          ...sanitizedRest,
        }
      })(),
      format.json(),
    )
    return { consoleFmt, jsonFmt }
  }

  // 构建默认日志器配置
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

  // 获取默认日志器实例
  getLogger() {
    return this.logger
  }

  getLoggerWithContext(context: string) {
    return this.logger.child({ context })
  }
}

function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACTION_DEPTH) {
    return '[MaxDepth]'
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1))
  }

  if (value instanceof Error) {
    return {
      name: getSafeErrorName(value),
      stack: sanitizeStack(value.stack),
    }
  }

  if (!isPlainRecord(value)) {
    return Object.prototype.toString.call(value)
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : sanitizeLogValue(nested, depth + 1)
  }
  return sanitized
}

function sanitizeLogRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeLogValue(value)
  return isPlainRecord(sanitized) ? sanitized : {}
}

function sanitizeStack(stack: unknown): string[] {
  if (Array.isArray(stack)) {
    return stack
      .filter((frame): frame is string => typeof frame === 'string')
      .map((frame) => frame.trim())
      .filter(isSafeStackFrame)
      .slice(0, 8)
  }

  if (typeof stack !== 'string') {
    return []
  }

  return stack
    .split('\n')
    .map((frame) => frame.trim())
    .filter(isSafeStackFrame)
    .slice(0, 8)
}

function isSafeStackFrame(frame: string): boolean {
  return frame.startsWith('at ') && !SENSITIVE_KEY_PATTERN.test(frame)
}

function sanitizeString(value: string): string {
  if (isDrizzleQueryMessage(value) || hasSensitiveDiagnosticLine(value)) {
    return DATABASE_ERROR_REDACTED
  }

  return value
    .replace(POSTGRES_URI_PATTERN, DATABASE_URI_REDACTED)
    .replace(CREDENTIAL_AUTHORITY_PATTERN, `//${REDACTED}@`)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, REDACTED)
}

function isDrizzleQueryMessage(value: string): boolean {
  const normalized = value.toLowerCase()
  return normalized.includes('failed query:') && normalized.includes('params:')
}

function hasSensitiveDiagnosticLine(value: string): boolean {
  return value
    .split('\n')
    .some((line) =>
      ['query:', 'params:', 'detail:'].some((prefix) =>
        line.trimStart().toLowerCase().startsWith(prefix),
      ),
    )
}

function getSafeErrorName(error: Error): string {
  return error.name && SAFE_ERROR_NAME_PATTERN.test(error.name)
    ? error.name
    : 'UnknownError'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
}
