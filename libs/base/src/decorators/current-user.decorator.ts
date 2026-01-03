import type { JwtUserInfoInterface } from '@libs/base/types'
import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

/**
 * CurrentUser 装饰器
 * 用于从请求中提取当前用户的信息
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const requestUser = request.user as JwtUserInfoInterface
    requestUser.sub = Number(requestUser.sub)
    return requestUser
  },
)

