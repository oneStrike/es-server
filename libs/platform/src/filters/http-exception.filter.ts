import type { FastifyReply, FastifyRequest } from 'fastify'
import { extractError, getPostgresErrorDescriptor } from '@db/core'
import { LoggerService } from '@libs/platform/modules'
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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * Known framework error mappings.
   * Database fallback uses the shared descriptor from db/core.
   */
  private readonly errorDescriptorMap: Record<string, ErrorDescriptor> = {
    // Fastify multipart errors
    FST_REQ_FILE_TOO_LARGE: {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: '\u4E0A\u4F20\u6587\u4EF6\u5927\u5C0F\u8D85\u51FA\u7CFB\u7EDF\u9650\u5236',
    },
    FST_FILES_LIMIT: {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      message: '\u4E0A\u4F20\u6587\u4EF6\u6570\u91CF\u8D85\u51FA\u7CFB\u7EDF\u9650\u5236',
    },
    FST_INVALID_MULTIPART_CONTENT_TYPE: {
      status: HttpStatus.BAD_REQUEST,
      message: '\u4E0A\u4F20\u6587\u4EF6\u4E0D\u80FD\u4E3A\u7A7A',
    },
  }

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

  private extractErrorInfo(exception: unknown): {
    status: number
    message: string | object
    code?: string
    constraint?: string
    table?: string
    column?: string
    detail?: string
  } {
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
        message: '\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF',
        code,
        constraint: postgresError.constraint,
        table: postgresError.table,
        column: postgresError.column,
        detail: postgresError.detail,
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF',
    }
  }

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

  private safeParse(req: FastifyRequest | undefined) {
    try {
      return req ? parseRequestLogFields(req) : undefined
    } catch {
      return undefined
    }
  }
}
