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
import { extractIpAddress } from '@/utils'

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
    } else if (path.includes('/client/')) {
      return this.loggerFactory.createClientLogger('HTTP')
    } else {
      return this.loggerFactory.createGlobalLogger('HTTP')
    }
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
    // 将开始时间保存在请求对象上，供异常过滤器使用
    req._startTime = startTime

    // 选择合适的日志器
    const logger = this.selectLogger(req)

    // 设置请求上下文
    const requestId = this.getRequestId(req)
    const ip = extractIpAddress(req)

    logger.setLogContext({
      requestId,
      ip,
      userAgent: req.headers['user-agent'],
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
        // 出错时不在拦截器中记录错误，避免与异常过滤器重复
        logger.clearContext()
        return throwError(() => error)
      }),
    )
  }
}
