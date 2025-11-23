import type { FastifyReply, FastifyRequest } from 'fastify'
import { LoggerService } from '@libs/logger'
import { parseRequestLogFields } from '@libs/utils'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v4 as uuidv4 } from 'uuid'

/**
 * HTTP异常过滤器
 * 统一处理应用中的HTTP异常，提供标准化的错误响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 数据库错误映射表
   */
  private readonly errorMessageMap: Record<string, string> = {
    /** 文件上传错误代码 */
    FST_REQ_FILE_TOO_LARGE: '上传文件大小超出系统限制',
    FST_FILES_LIMIT: '上传文件数量超出系统限制',
    FST_INVALID_MULTIPART_CONTENT_TYPE: '上传文件不得为空',
    /** 数据库错误代码 */
    P2025: '未找到相关记录',
    P2002: '唯一约束失败',
  }

  /**
   * 捕获并处理异常
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { status, message } = this.extractErrorInfo(exception)
    const traceId = uuidv4()
    const parsed = this.safeParse(request)
    const logger = this.loggerService.getLoggerWithContext('http-exception')
    const payload = {
      traceId,
      status,
      path: parsed?.path,
      method: parsed?.method,
      ip: parsed?.ip,
      message,
    }
    const stack = exception instanceof Error ? exception.stack : undefined
    const { message: errorMessage, ...rest } = payload
    logger.log({ level: 'error', message: 'http_exception', stack, errorMessage, ...rest })

    const errorResponse = {
      code: status,
      message,
      traceId,
    }
    response.header('X-Trace-Id', traceId).code(status).send(errorResponse)
  }

  /**
   * 提取异常信息
   */
  private extractErrorInfo(exception: unknown): {
    status: number
    message: string | object
    details?: any
  } {
    const isProduction = this.configService.get('NODE_ENV') === 'production'

    if (exception instanceof HttpException) {
      const code = exception.getStatus()
      const response = exception.getResponse() as any
      return {
        status: code,
        message: Array.isArray(response?.message)
          ? response.message.join('，')
          : response.message
            ? response.message
            : response,
      }
    }

    // 处理数据库错误（Prisma等），对未知错误码提供合理回退
    if (exception instanceof Error && 'code' in exception) {
      const code = (exception as { code?: any }).code
      const knownMessage = this.errorMessageMap[code]
      const fallbackMessage = isProduction
        ? knownMessage || '数据库错误'
        : knownMessage || exception.message || '数据库错误'
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: fallbackMessage,
        details: { code },
      }
    }

    // 处理其他类型的异常
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: isProduction
          ? '内部服务器错误'
          : exception.message || '内部服务器错误',
      }
    }

    // 未知异常类型
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction ? '内部服务器错误' : '未知错误',
    }
  }

  private safeParse(req: FastifyRequest | undefined) {
    try {
      return req ? parseRequestLogFields(req) : undefined
    } catch {
      return undefined
    }
  }
}
