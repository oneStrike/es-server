import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import type { Observable } from 'rxjs'
import { HttpStatus, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { tap } from 'rxjs'
import { SKIP_POST_STATUS_NORMALIZATION_KEY } from '../decorators/skip-post-status-normalization.decorator'

@Injectable()
export class PostSuccessStatusInterceptor implements NestInterceptor {
  /** 缓存 handler → 是否跳过的映射，避免每次请求都走 Reflect.getMetadata */
  private readonly skipCache = new WeakMap<
    (...args: unknown[]) => unknown,
    boolean
  >()

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const http = context.switchToHttp()
    const request = http.getRequest<{ method?: string }>()
    if (request.method !== 'POST') {
      return next.handle()
    }

    const handler = context.getHandler() as (
      ...args: unknown[]
    ) => unknown
    let shouldSkip = this.skipCache.get(handler)
    if (shouldSkip === undefined) {
      shouldSkip =
        this.reflector.getAllAndOverride<boolean>(
          SKIP_POST_STATUS_NORMALIZATION_KEY,
          [handler, context.getClass()],
        ) ?? false
      this.skipCache.set(handler, shouldSkip)
    }
    if (shouldSkip) {
      return next.handle()
    }

    const response = http.getResponse<FastifyReply & { statusCode: number }>()

    return next.handle().pipe(
      tap(() => {
        if (response.statusCode === HttpStatus.CREATED) {
          response.code(HttpStatus.OK)
        }
      }),
    )
  }
}
