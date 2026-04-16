import type { FastifyReply, FastifyRequest } from 'fastify'
import { extractError, getPostgresErrorResponseDescriptor } from '@db/core'

import {
  getPlatformErrorCode,
  PlatformErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { LoggerService } from '@libs/platform/modules/logger'
import { buildRequestLogFields } from '@libs/platform/utils'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'

interface ErrorDescriptor {
  status: HttpStatus
  responseCode: number
  message: string
  businessCode?: number
}

const ROUTE_NOT_FOUND_MESSAGE_REGEX = /^Cannot\b/i
type FilterErrorInput =
  | Error
  | {
      code?: string
      constraint?: string
      table?: string
      column?: string
      detail?: string
      message?: string
      cause?: object | null
    }
    | null
    | undefined

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
      responseCode: PlatformErrorCode.PAYLOAD_TOO_LARGE,
      message: '上传文件大小超出系统限制',
    },
    FST_FILES_LIMIT: {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      responseCode: PlatformErrorCode.PAYLOAD_TOO_LARGE,
      message: '上传文件数量超出系统限制',
    },
    FST_INVALID_MULTIPART_CONTENT_TYPE: {
      status: HttpStatus.BAD_REQUEST,
      responseCode: PlatformErrorCode.BAD_REQUEST,
      message: '上传文件不能为空',
    },
  }

  /**
   * 异常处理入口
   *
   * 提取错误信息、记录结构化日志，并返回统一的响应格式。
   */
  catch(exception: FilterErrorInput, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    const {
      status,
      responseCode,
      message,
      code,
      constraint,
      table,
      column,
      detail,
      businessCode,
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
      businessCode,
      errorMessage: message,
      stack: exception instanceof Error ? exception.stack : undefined,
      status,
      path: parsed?.path,
      method: parsed?.method,
      ip: parsed?.ip,
      params: parsed?.params,
    })

    response.code(status).send({
      code: responseCode,
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
  private extractErrorInfo(exception: FilterErrorInput) {
    const postgresError = this.extractPostgresError(exception)

    if (exception instanceof BusinessException) {
      return {
        status: HttpStatus.OK,
        responseCode: exception.code,
        message: exception.message,
        businessCode: exception.code,
        code: postgresError?.code,
        constraint: postgresError?.constraint,
        table: postgresError?.table,
        column: postgresError?.column,
        detail: postgresError?.detail,
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const response = exception.getResponse()
      const message = this.normalizeMessage(
        typeof response === 'string' || Array.isArray(response)
          ? response
          : response && typeof response === 'object'
            ? { message: (response as { message?: string }).message }
            : undefined,
      )
      return {
        status,
        responseCode: this.isRouteNotFoundMessage(message)
          ? PlatformErrorCode.ROUTE_NOT_FOUND
          : getPlatformErrorCode(status),
        message,
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
        getPostgresErrorResponseDescriptor(code) ??
        this.errorDescriptorMap[code]
      if (descriptor) {
        return {
          status: descriptor.status,
          responseCode: descriptor.responseCode,
          message: descriptor.message,
          businessCode:
            descriptor.status === HttpStatus.OK
              ? descriptor.responseCode
              : undefined,
          code,
          constraint: postgresError.constraint,
          table: postgresError.table,
          column: postgresError.column,
          detail: postgresError.detail,
        }
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        responseCode: PlatformErrorCode.INTERNAL_SERVER_ERROR,
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
      responseCode: PlatformErrorCode.INTERNAL_SERVER_ERROR,
      message: '内部服务器错误',
    }
  }

  /**
   * 提取 Postgres 错误
   *
   * 支持直接抛出的数据库错误，以及 HttpException 包装的数据库错误（通过 cause 传递）。
   */
  private extractPostgresError(exception: FilterErrorInput) {
    const directError = extractError(exception)
    if (directError) {
      return directError
    }

    if (exception instanceof HttpException) {
      return extractError(exception.cause as FilterErrorInput)
    }

    return null
  }

  private normalizeMessage(payload: string | string[] | { message?: string } | null | undefined): string {
    if (Array.isArray(payload)) {
      const messages = payload
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
      return messages.length > 0 ? messages.join('；') : '内部服务器错误'
    }

    if (typeof payload === 'string') {
      return payload
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as { message?: string }).message === 'string'
    ) {
      return (payload as { message: string }).message
    }

    return '内部服务器错误'
  }

  private isRouteNotFoundMessage(message: string) {
    return (
      message === 'Not Found' || ROUTE_NOT_FOUND_MESSAGE_REGEX.test(message)
    )
  }

  /**
   * 安全解析请求日志字段
   *
   * 解析失败时返回 undefined，避免日志记录本身影响异常处理流程。
   */
  private safeParse(req: FastifyRequest | undefined) {
    try {
      return req ? buildRequestLogFields(req) : undefined
    } catch {
      return undefined
    }
  }
}
