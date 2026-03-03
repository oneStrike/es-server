import type { JwtUserInfoInterface } from '@libs/base/types'
import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

/**
 * CurrentUser 装饰器支持的字段类型
 */
export type UserField = keyof JwtUserInfoInterface

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
    const request = ctx.switchToHttp().getRequest()
    const requestUser = request.user as JwtUserInfoInterface
    if (!requestUser) {
      return null
    }
    requestUser.sub = Number(requestUser.sub)

    // 如果传入了字段名，返回该字段的值；否则返回完整用户信息
    return data ? requestUser[data] : requestUser
  },
)
