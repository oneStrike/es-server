import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { Injectable, NestInterceptor } from '@nestjs/common'
import { map } from 'rxjs/operators'
import { LoggerService } from '@/modules/system/logger/logger.service'
import { parseRequestLogFields } from '@/utils'

export interface Response<T> {
  code: number
  data: T
  message: string
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  constructor(private readonly loggerService: LoggerService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    const startTime = Date.now()

    return next.handle().pipe(
      map((data) => {
        // 如果是 POST 请求且响应状态码为 201，则修改为 200
        if (request.method === 'POST' && response.statusCode === 201) {
          response.statusCode = 200
        }

        // 记录成功请求日志
        this.logSuccessRequest(request, response, startTime)

        return {
          code: 200,
          data,
          message: 'success',
        }
      }),
    )
  }

  /**
   * 记录成功请求日志
   */
  private logSuccessRequest(
    request: any,
    response: any,
    startTime: number,
  ): void {
    try {
      const parsed = parseRequestLogFields(request)
      const logger = this.loggerService.pickLogger(parsed.apiType)
      const duration = Date.now() - startTime

      const payload = {
        status: response.statusCode || 200,
        path: parsed.path,
        method: parsed.method,
        ip: parsed.ip,
        userAgent: parsed.userAgent,
        device: parsed.device,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }

      logger.log({
        level: 'info',
        message: JSON.stringify(payload),
      })
    } catch (error) {
      // 记录日志失败不应该影响正常请求处理
      console.warn('记录请求日志失败:', error)
    }
  }
}
