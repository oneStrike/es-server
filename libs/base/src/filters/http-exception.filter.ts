import type { FastifyReply, FastifyRequest } from 'fastify'
import { LoggerService } from '@libs/base/modules'
import { parseRequestLogFields } from '@libs/base/utils'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'

/**
 * HTTP异常过滤器
 * 统一处理应用中的HTTP异常，提供标准化的错误响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * 数据库错误映射表
   */
  private readonly errorMessageMap: Record<string, string> = {
    /** 文件上传错误代码 */
    FST_REQ_FILE_TOO_LARGE: '上传文件大小超出系统限制',
    FST_FILES_LIMIT: '上传文件数量超出系统限制',
    FST_INVALID_MULTIPART_CONTENT_TYPE: '上传文件不能为空',
    /** 数据库错误代码 */
    P2025: '记录或关联记录不存在',
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
    const parsed = this.safeParse(request)
    const logger = this.loggerService.getLoggerWithContext('http-exception')

    logger.log({
      level: 'error',
      message: 'http_exception',
      errorMessage: message,
      stack: exception instanceof Error ? exception.stack : undefined,
      status,
      path: parsed?.path,
      method: parsed?.method,
      ip: parsed?.ip,
    })

    const errorResponse = {
      code: status,
      data: null,
      message,
    }
    response.code(status).send(errorResponse)
  }

  /**
   * 提取异常信息
   */
  private extractErrorInfo(exception: unknown): {
    status: number
    message: string | object
    details?: any
  } {
    if (exception instanceof HttpException) {
      const code = exception.getStatus()
      const response = exception.getResponse() as any
      return {
        status: code,
        message: response.message ? response.message : response,
      }
    }

    // 处理数据库错误（Prisma等），对未知错误码提供合理回退
    if (exception instanceof Error && 'code' in exception) {
      const code = (exception as { code?: any }).code
      const knownMessage = this.errorMessageMap[code]
      const fallbackMessage = knownMessage || exception.message
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
        message: exception.message || '内部服务器错误',
      }
    }

    // 未知异常类型
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '内部服务器错误',
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
