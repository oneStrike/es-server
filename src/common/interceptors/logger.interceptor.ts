import type { FastifyRequest } from 'fastify'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, throwError } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { LoggerFactoryService } from '@/common/module/logger/logger-factory.service'
import { CustomLoggerService } from '@/common/module/logger/logger.service'

/**
 * 日志拦截器
 * 自动记录所有HTTP请求和响应
 * 根据请求路径自动选择合适的日志器（admin/client/global）
 */
@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  constructor(private readonly loggerFactory: LoggerFactoryService) {}

  /**
   * 根据请求路径选择合适的日志器
   */
  private selectLogger(req: FastifyRequest): CustomLoggerService {
    const path = req.url

    // 根据路径选择对应的日志器
    if (path.includes('/admin/')) {
      return this.loggerFactory.createAdminLogger('HTTP')
    }
    else if (path.includes('/client/')) {
      return this.loggerFactory.createClientLogger('HTTP')
    }
    else {
      return this.loggerFactory.createGlobalLogger('HTTP')
    }
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIp(req: FastifyRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || (req.headers['x-real-ip'] as string)
      || req.ip
      || 'unknown'
    )
  }

  /**
   * 获取请求ID（如果有的话）
   */
  private getRequestId(req: FastifyRequest): string | undefined {
    return req.headers['x-request-id'] as string | undefined
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp()
    const req = ctx.getRequest<FastifyRequest>()
    const startTime = Date.now()

    // 选择合适的日志器
    const logger = this.selectLogger(req)

    // 设置请求上下文
    const requestId = this.getRequestId(req)
    const ip = this.getClientIp(req)

    logger.setLogContext({
      requestId,
      ip,
      userAgent: req.headers['user-agent'],
    })

    // 记录请求开始
    logger.debug(`Incoming request: ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: this.filterSensitiveHeaders(req.headers),
    })

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime
        const res = ctx.getResponse()
        const statusCode = res.statusCode || 200

        // 记录请求成功
        logger.logRequest(req.method, req.url, statusCode, responseTime, {
          responseSize: data ? JSON.stringify(data).length : 0,
        })

        // 清除上下文
        logger.clearContext()
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime
        const statusCode = error.status || 500

        // 记录请求失败
        logger.logRequest(req.method, req.url, statusCode, responseTime, {
          error: error.message,
          stack: error.stack,
        })

        // 清除上下文
        logger.clearContext()

        return throwError(() => error)
      }),
    )
  }

  /**
   * 过滤敏感请求头（如Authorization）
   */
  private filterSensitiveHeaders(headers: any): any {
    const filtered = { ...headers }
    const sensitiveKeys = ['authorization', 'cookie', 'x-api-key']

    sensitiveKeys.forEach((key) => {
      if (filtered[key]) {
        filtered[key] = '***'
      }
    })

    return filtered
  }
}
