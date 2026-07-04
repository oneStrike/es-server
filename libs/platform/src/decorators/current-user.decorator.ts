import type { JwtUserInfoInterface } from '@libs/platform/types'
import type { ExecutionContext } from '@nestjs/common'
import type { CurrentUserRequest, UserField } from './current-user.type'
import { createParamDecorator } from '@nestjs/common'

/**
 * CurrentUser 装饰器
 * 用于从请求中提取当前用户的信息
 *
 * @example
 * // 获取完整用户信息
 * @CurrentUser() user: JwtUserInfoInterface
 *
 * @example
 * // 只获取用户ID
 * @CurrentUser('sub') userId: number
 *
 * @example
 * // 只获取用户名
 * @CurrentUser('username') username: string
 */
export const CurrentUser = createParamDecorator(
  (data: UserField | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<CurrentUserRequest>()
    const requestUser = request.user
    if (!requestUser) {
      return null
    }
    const normalizedUser: JwtUserInfoInterface = {
      ...requestUser,
      sub: Number(requestUser.sub),
    }
    // 如果传入了字段名，返回该字段的值；否则返回完整用户信息
    return data ? normalizedUser[data] : normalizedUser
  },
)
