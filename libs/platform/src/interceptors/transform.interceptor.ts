import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'
import type { TransformResponse } from './transform-interceptor.type'
import { ApiSuccessCode } from '@libs/platform/constant'
import { Injectable, NestInterceptor } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { map } from 'rxjs/operators'

export type { TransformResponse } from './transform-interceptor.type'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  TransformResponse<T>
> {
  constructor(private readonly clsService: ClsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<TransformResponse<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const response = context.switchToHttp().getResponse<FastifyReply>()
    response.header('x-request-id', this.clsService.getId())

    return next.handle().pipe(
      map((data: T) => {
        // 如果是 POST 请求且响应状态码为 201，则修改为 200
        if (request.method === 'POST' && response.statusCode === 201) {
          response.statusCode = 200
        }

        return {
          code: ApiSuccessCode,
          data,
          message: 'success',
        }
      }),
    )
  }
}
