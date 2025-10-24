import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'

/**
 * HTTP异常过滤器
 * 统一处理应用中的HTTP异常，提供标准化的错误响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger: CustomLoggerService

  constructor(
    @Inject(LoggerFactoryService)
    private readonly loggerFactory: LoggerFactoryService,
  ) {
    this.logger = this.loggerFactory.createGlobalLogger('ExceptionFilter')
  }

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
    const request = ctx.getRequest<FastifyRequest>()
    const response = ctx.getResponse<FastifyReply>()

    const { status, message } = this.extractErrorInfo(exception)

    // 根据请求路径选择合适的日志器
    const logger = this.selectLogger(request)

    // 记录异常信息
    if (exception instanceof Error) {
      logger.error(
        `Exception caught: ${message}`,
        exception.stack,
        {
          method: request.method,
          url: request.url,
          statusCode: status,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          exceptionType: exception.constructor.name,
        },
      )
    }
    else {
      logger.error(
        `Exception caught: ${message}`,
        undefined,
        {
          method: request.method,
          url: request.url,
          statusCode: status,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
      )
    }

    const errorResponse = {
      code: status,
      message,
    }
    // 将完整的错误响应添加到response对象上，供日志拦截器使用
    // @ts-expect-error ignore
    response.errorResponse = errorResponse
    response.code(status).send(errorResponse)
  }

  /**
   * 根据请求路径选择合适的日志器
   */
  private selectLogger(req: FastifyRequest): CustomLoggerService {
    const path = req.url

    if (path.includes('/admin/')) {
      return this.loggerFactory.createAdminLogger('ExceptionFilter')
    }
    else if (path.includes('/client/')) {
      return this.loggerFactory.createClientLogger('ExceptionFilter')
    }
    else {
      return this.logger
    }
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
        message: Array.isArray(response?.message)
          ? response.message.join('，')
          : response.message
            ? response.message
            : response,
      }
    }

    // 处理数据库错误
    if (exception instanceof Error && 'code' in exception) {
      const code = (exception as { code?: any }).code
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: this.errorMessageMap[code],
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
      message: '未知错误',
    }
  }
}
