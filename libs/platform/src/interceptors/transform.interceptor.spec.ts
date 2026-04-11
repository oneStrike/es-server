import type { CallHandler, ExecutionContext } from '@nestjs/common'
import type { ClsService } from 'nestjs-cls'
import { lastValueFrom, of } from 'rxjs'
import { TransformInterceptor } from './transform.interceptor'

describe('transformInterceptor', () => {
  function createExecutionContext(
    method: string,
    response: { statusCode: number, header: jest.Mock },
  ) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method }),
        getResponse: () => response,
      }),
    } as ExecutionContext
  }

  function createCallHandler(data: unknown) {
    return {
      handle: () => of(data),
    } as CallHandler
  }

  it('成功响应统一返回 code=0', async () => {
    const clsService = { getId: jest.fn().mockReturnValue('req-1') } as any
    const interceptor = new TransformInterceptor(clsService as ClsService)
    const response = {
      statusCode: 200,
      header: jest.fn(),
    }

    await expect(
      lastValueFrom(
        interceptor.intercept(
          createExecutionContext('GET', response),
          createCallHandler({ id: 1 }),
        ),
      ),
    ).resolves.toEqual({
      code: 0,
      data: { id: 1 },
      message: 'success',
    })
  })

  it('pOST 201 会被统一收敛为 200', async () => {
    const clsService = { getId: jest.fn().mockReturnValue('req-2') } as any
    const interceptor = new TransformInterceptor(clsService as ClsService)
    const response = {
      statusCode: 201,
      header: jest.fn(),
    }

    await expect(
      lastValueFrom(
        interceptor.intercept(
          createExecutionContext('POST', response),
          createCallHandler(true),
        ),
      ),
    ).resolves.toEqual({
      code: 0,
      data: true,
      message: 'success',
    })

    expect(response.statusCode).toBe(200)
  })
})
