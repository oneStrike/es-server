import type { ArgumentsHost } from '@nestjs/common'
import { PlatformErrorCode } from '@libs/platform/constant'
import { BusinessErrorCode } from '@libs/platform/constant/error-code.constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common'
import { HttpExceptionFilter } from './http-exception.filter'

describe('httpExceptionFilter', () => {
  function createHost() {
    const send = jest.fn()
    const code = jest.fn().mockReturnValue({ send })
    const request = {
      method: 'GET',
      url: '/app/test',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      params: {},
      query: {},
      body: {},
    }
    const response = { code }

    return {
      host: {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as ArgumentsHost,
      request,
      response,
      code,
      send,
    }
  }

  function createFilter() {
    const logger = { log: jest.fn() }
    const loggerService = {
      getLoggerWithContext: jest.fn().mockReturnValue(logger),
    }

    return {
      filter: new HttpExceptionFilter(loggerService as any),
      logger,
    }
  }

  it('businessException 返回 HTTP 200 和业务 code', () => {
    const { filter } = createFilter()
    const { host, code, send } = createHost()

    filter.catch(
      new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '用户不存在'),
      host,
    )

    expect(code).toHaveBeenCalledWith(HttpStatus.OK)
    expect(send).toHaveBeenCalledWith({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      data: null,
      message: '用户不存在',
    })
  })

  it('参数格式错误保持 400 / 10001', () => {
    const { filter } = createFilter()
    const { host, code, send } = createHost()

    filter.catch(new BadRequestException('orderBy 参数格式不合法'), host)

    expect(code).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(send).toHaveBeenCalledWith({
      code: PlatformErrorCode.BAD_REQUEST,
      data: null,
      message: 'orderBy 参数格式不合法',
    })
  })

  it('业务资源不存在保持 HTTP 200 + 20001', () => {
    const { filter } = createFilter()
    const { host, code, send } = createHost()

    filter.catch(
      new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '帖子不存在'),
      host,
    )

    expect(code).toHaveBeenCalledWith(HttpStatus.OK)
    expect(send).toHaveBeenCalledWith({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      data: null,
      message: '帖子不存在',
    })
  })

  it('路由不存在保持 404 / 10004', () => {
    const { filter } = createFilter()
    const { host, code, send } = createHost()

    filter.catch(new NotFoundException('Cannot GET /missing'), host)

    expect(code).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
    expect(send).toHaveBeenCalledWith({
      code: PlatformErrorCode.ROUTE_NOT_FOUND,
      data: null,
      message: 'Cannot GET /missing',
    })
  })
})
