import type { FastifyReply, FastifyRequest } from 'fastify'
import { extractError, getPostgresErrorDescriptor } from '@db/core'
import { LoggerService } from '@libs/platform/modules/logger'
import { parseRequestLogFields } from '@libs/platform/utils'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'

interface ErrorDescriptor {
  status: HttpStatus
  message: string
}

/**
 * 全局异常过滤器
 *
 * 统一捕获并处理所有未处理的异常，转换为标准响应格式。
 * 支持 HttpException、Postgres 数据库错误、Fastify multipart 错误等，
 * 并输出结构化日志用于问题排查。
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * 已知框架错误映射表
   *
   * 数据库错误优先使用 db/core 提供的共享描述器，
   * 此处仅补充 Fastify multipart 相关的业务错误映射。
   */
  private readonly errorDescriptorMap: Record<string, ErrorDescriptor> = {
    FST_REQ_FILE_TOO_LARGE: {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: '上传文件大小超出系统限制',
    },
    FST_FILES_LIMIT: {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: '上传文件数量超出系统限制',
    },
    FST_INVALID_MULTIPART_CONTENT_TYPE: {
      status: HttpStatus.BAD_REQUEST,
      message: '上传文件不能为空',
    },
  }

  /**
   * 异常处理入口
   *
   * 提取错误信息、记录结构化日志，并返回统一的响应格式。
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const {
      status,
      message,
      code,
      constraint,
      table,
      column,
      detail,
    } = this.extractErrorInfo(exception)
    const parsed = this.safeParse(request)
    const logger = this.loggerService.getLoggerWithContext('http-exception')

    logger.log({
      level: 'error',
      message: 'http_exception',
      errorCode: code,
      errorConstraint: constraint,
      errorTable: table,
      errorColumn: column,
      errorDetail: detail,
      errorMessage: message,
      stack: exception instanceof Error ? exception.stack : undefined,
      status,
      path: parsed?.path,
      method: parsed?.method,
      ip: parsed?.ip,
      params: parsed?.params,
    })

    response.code(status).send({
      code: status,
      data: null,
      message,
    })
  }

  /**
   * 提取异常信息
   *
   * 按优先级处理：HttpException > Postgres 错误 > 未知错误。
   * 对于数据库错误，尽可能提取约束、表名、字段等上下文信息。
   */
  private extractErrorInfo(exception: unknown) {
    const postgresError = this.extractPostgresError(exception)

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const response = exception.getResponse() as any
      return {
        status,
        message: response?.message ?? response,
        code: postgresError?.code,
        constraint: postgresError?.constraint,
        table: postgresError?.table,
        column: postgresError?.column,
        detail: postgresError?.detail,
      }
    }

    if (postgresError) {
      const code = postgresError.code
      const descriptor =
        getPostgresErrorDescriptor(code) ?? this.errorDescriptorMap[code]
      if (descriptor) {
        return {
          status: descriptor.status,
          message: descriptor.message,
          code,
          constraint: postgresError.constraint,
          table: postgresError.table,
          column: postgresError.column,
          detail: postgresError.detail,
        }
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '内部服务器错误',
        code,
        constraint: postgresError.constraint,
        table: postgresError.table,
        column: postgresError.column,
        detail: postgresError.detail,
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '内部服务器错误',
    }
  }

  /**
   * 提取 Postgres 错误
   *
   * 支持直接抛出的数据库错误，以及 HttpException 包装的数据库错误（通过 cause 传递）。
   */
  private extractPostgresError(exception: unknown) {
    const directError = extractError(exception)
    if (directError) {
      return directError
    }

    if (exception instanceof HttpException) {
      return extractError(exception.cause)
    }

    return null
  }

  /**
   * 安全解析请求日志字段
   *
   * 解析失败时返回 undefined，避免日志记录本身影响异常处理流程。
   */
  private safeParse(req: FastifyRequest | undefined) {
    try {
      return req ? parseRequestLogFields(req) : undefined
    } catch {
      return undefined
    }
  }
}
