import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { Observable } from 'rxjs'
import type { Response } from './transform.types'
import { Injectable, NestInterceptor } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { map } from 'rxjs/operators'

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  constructor(private readonly clsService: ClsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()
    response.header('x-request-id', this.clsService.getId())

    return next.handle().pipe(
      map((data) => {
        // 如果是 POST 请求且响应状态码为 201，则修改为 200
        if (request.method === 'POST' && response.statusCode === 201) {
          response.statusCode = 200
        }

        return {
          code: 200,
          data,
          message: 'success',
        }
      }),
    )
  }
}
