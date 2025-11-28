import type { FastifyRequest } from 'fastify'
// 导入 AuditMetadata 类型
import type { AuditMetadata } from '../decorators/audit.decorator'
import { ActionTypeEnum } from '@libs/types'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { catchError, Observable, tap } from 'rxjs'

import { AuditService } from '../../modules/system/audit/audit.service'

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const metadata = this.reflector.get<AuditMetadata>(
      'audit',
      context.getHandler(),
    )

    // 如果标记为忽略审计，则直接跳过
    if (!metadata || metadata?.ignore) {
      return next.handle()
    }
    return next.handle().pipe(
      tap(() => {
        // 请求成功时记录审计日志，使用 void 操作符明确忽略 Promise 返回值
        void this.logAudit(request, true, metadata)
      }),
      catchError((error) => {
        // 请求失败时记录审计日志，使用 void 操作符明确忽略 Promise 返回值
        void this.logAudit(request, false, metadata)
        // 继续抛出错误
        throw error
      }),
    )
  }

  /**
   * 记录审计日志
   * @param request FastifyRequest 对象
   * @param isSuccess 是否成功
   * @param metadata 审计元数据
   */
  private async logAudit(
    request: FastifyRequest,
    isSuccess: boolean,
    metadata: AuditMetadata,
  ) {
    try {
      // 从请求中获取用户信息
      const user = request.user
      const userId = Number(user?.sub)
      const username = user?.username
      // 构建审计日志内容
      const content = `${metadata.content}${isSuccess ? '成功' : '失败'}`
      const actionType = metadata.actionType

      const logContent = {
        userId,
        username,
        content,
        actionType,
        isSuccess,
      }

      if (actionType === ActionTypeEnum.LOGIN) {
        // @ts-expect-error ignore
        logContent.username = request.body.username
      }

      // 调用审计服务记录日志
      await this.auditService.createRequestLog(logContent, request)
    } catch (error) {
      // 审计日志记录失败时，只打印错误，不影响业务流程
      console.error('审计日志记录失败:', error)
    }
  }

  /**
   * 根据 HTTP 方法获取操作类型
   * @param method HTTP 方法
   * @returns 操作类型
   */
  private getActionType(method: string): ActionTypeEnum {
    switch (method.toUpperCase()) {
      case 'POST':
        return ActionTypeEnum.CREATE
      case 'PUT':
      case 'PATCH':
        return ActionTypeEnum.UPDATE
      case 'DELETE':
        return ActionTypeEnum.DELETE
      default:
        // 对于 GET 等其他方法，使用 CREATE 作为默认值
        return ActionTypeEnum.CREATE
    }
  }
}
