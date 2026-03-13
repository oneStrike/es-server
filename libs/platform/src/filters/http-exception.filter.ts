import type { FastifyReply, FastifyRequest } from 'fastify'
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
   * Known framework/Prisma error mappings.
   * Keep this as the single global fallback map.
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
    // Prisma errors
    P2002: {
      status: HttpStatus.CONFLICT,
      message:
        '\u6570\u636E\u5DF2\u5B58\u5728\uFF0C\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4',
    },
    P2025: {
      status: HttpStatus.NOT_FOUND,
      message: '\u8BB0\u5F55\u4E0D\u5B58\u5728',
    },
    P2034: {
      status: HttpStatus.CONFLICT,
      message: '\u8BF7\u6C42\u51B2\u7A81\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
    },
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const { status, message, code } = this.extractErrorInfo(exception)
    const parsed = this.safeParse(request)
    const logger = this.loggerService.getLoggerWithContext('http-exception')

    logger.log({
      level: 'error',
      message: 'http_exception',
      errorCode: code,
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
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const response = exception.getResponse() as any
      return {
        status,
        message: response?.message ?? response,
      }
    }

    if (this.hasErrorCode(exception)) {
      const code = exception.code
      const descriptor = this.errorDescriptorMap[code]
      if (descriptor) {
        return {
          status: descriptor.status,
          message: descriptor.message,
          code,
        }
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF',
        code,
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF',
    }
  }

  private hasErrorCode(
    exception: unknown,
  ): exception is Error & { code: string } {
    return (
      exception instanceof Error &&
      'code' in exception &&
      typeof (exception as { code?: unknown }).code === 'string'
    )
  }

  private safeParse(req: FastifyRequest | undefined) {
    try {
      return req ? parseRequestLogFields(req) : undefined
    } catch {
      return undefined
    }
  }
}
