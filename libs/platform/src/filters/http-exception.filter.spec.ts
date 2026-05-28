import { BusinessErrorCode, PlatformErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { HttpExceptionFilter } from './http-exception.filter'

describe('HttpExceptionFilter', () => {
  it('maps direct PostgreSQL unique violations through the shared descriptor', () => {
    const { body, status, log } = runFilter({
      code: '23505',
      constraint: 'app_user_phone_key',
      table: 'app_user',
      column: 'phone_number',
      detail: 'Key already exists',
    })

    expect(status).toBe(200)
    expect(body).toEqual({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      data: null,
      message: '数据已存在',
    })
    expect(log).toMatchObject({
      errorCode: '23505',
      errorConstraint: 'app_user_phone_key',
      errorTable: 'app_user',
      errorColumn: 'phone_number',
      errorDetail: 'Key already exists',
      businessCode: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
    })
  })

  it('logs PostgreSQL metadata from an HttpException cause while preserving HTTP semantics', () => {
    const exception = new BadRequestException('请求非法', {
      cause: {
        code: '23502',
        column: 'name',
        table: 'app_user',
      },
    })
    const { body, status, log } = runFilter(exception)

    expect(status).toBe(400)
    expect(body).toEqual({
      code: PlatformErrorCode.BAD_REQUEST,
      data: null,
      message: '请求非法',
    })
    expect(log).toMatchObject({
      errorCode: '23502',
      errorTable: 'app_user',
      errorColumn: 'name',
    })
  })

  it('returns internal server error for unknown PostgreSQL codes and logs metadata', () => {
    const { body, status, log } = runFilter({
      code: '99999',
      constraint: 'mystery_constraint',
      detail: 'unknown database failure',
    })

    expect(status).toBe(500)
    expect(body).toEqual({
      code: PlatformErrorCode.INTERNAL_SERVER_ERROR,
      data: null,
      message: '内部服务器错误',
    })
    expect(log).toMatchObject({
      errorCode: '99999',
      errorConstraint: 'mystery_constraint',
      errorDetail: 'unknown database failure',
    })
  })

  it('returns business exception code and logs PostgreSQL cause metadata', () => {
    const cause = { code: '23505', constraint: 'notification_template_key' }
    const exception = new BusinessException(
      BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      '该通知分类的模板已存在',
      { cause },
    )
    const { body, status, log } = runFilter(exception)

    expect(status).toBe(200)
    expect(body).toEqual({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      data: null,
      message: '该通知分类的模板已存在',
    })
    expect(log).toMatchObject({
      businessCode: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      errorCode: '23505',
      errorConstraint: 'notification_template_key',
    })
  })

  it('keeps multipart descriptor behavior', () => {
    const { body, status } = runFilter({
      code: 'FST_REQ_FILE_TOO_LARGE',
      message: 'request file too large',
    })

    expect(status).toBe(413)
    expect(body).toEqual({
      code: PlatformErrorCode.PAYLOAD_TOO_LARGE,
      data: null,
      message: '上传文件大小超出系统限制',
    })
  })

  it('maps route-not-found messages to the route-not-found platform code', () => {
    const { body, status } = runFilter(new NotFoundException('Cannot GET /x'))

    expect(status).toBe(404)
    expect(body).toEqual({
      code: PlatformErrorCode.ROUTE_NOT_FOUND,
      data: null,
      message: 'Cannot GET /x',
    })
  })
})

function runFilter(exception: unknown) {
  const sent: { status?: number; body?: unknown } = {}
  const log = jest.fn()
  const filter = new HttpExceptionFilter({
    getLoggerWithContext: jest.fn(() => ({ log })),
  } as never)
  const request = {
    method: 'GET',
    url: '/test',
    ip: '127.0.0.1',
    params: {},
  }
  const reply = {
    code: jest.fn((status: number) => {
      sent.status = status
      return reply
    }),
    send: jest.fn((body: unknown) => {
      sent.body = body
      return reply
    }),
  }
  const host = {
    switchToHttp: jest.fn(() => ({
      getResponse: () => reply,
      getRequest: () => request,
    })),
  }

  filter.catch(exception, host as never)

  return {
    status: sent.status,
    body: sent.body,
    log: log.mock.calls[0]?.[0],
  }
}
