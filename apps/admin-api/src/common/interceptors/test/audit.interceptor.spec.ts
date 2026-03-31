import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { of } from 'rxjs'
import { AuditActionTypeEnum } from '../../../modules/system/audit/audit.constant'
import { AuditInterceptor } from '../audit.interceptor'

describe('audit interceptor login log fallback', () => {
  /**
   * `@Public()` 登录请求没有 `request.user`，审计链路需要把 userId 视为缺省值，
   * 不能把 `Number(undefined)` 产生的 `NaN` 继续传给数据库。
   */
  it('omits userId for public login requests', async () => {
    const createRequestLog = jest.fn().mockResolvedValue({ id: 1 })
    const reflector = {
      get: jest.fn().mockReturnValue({
        actionType: AuditActionTypeEnum.LOGIN,
        content: '用户登录',
      }),
    } as unknown as Reflector

    const interceptor = new AuditInterceptor(reflector, {
      createRequestLog,
    } as any)

    const request = {
      body: {
        username: 'admin001',
      },
      headers: {},
      method: 'POST',
      url: '/api/admin/auth/login',
    } as FastifyRequest

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => (() => undefined) as any,
    } as ExecutionContext

    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context, {
        handle: () => of(true),
      } as CallHandler).subscribe({
        complete: resolve,
        error: reject,
      })
    })

    expect(createRequestLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
        username: 'admin001',
        actionType: AuditActionTypeEnum.LOGIN,
        isSuccess: true,
        content: '用户登录成功',
      }),
      request,
    )
  })
})
