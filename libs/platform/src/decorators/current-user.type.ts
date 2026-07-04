import type { JwtUserInfoInterface } from '@libs/platform/types'
import type { FastifyRequest } from 'fastify'

/** CurrentUser 装饰器支持读取的 JWT 用户字段名。 */
export type UserField = keyof JwtUserInfoInterface

/** JWT 鉴权链路注入到 FastifyRequest 的用户对象。 */
export interface CurrentUserRequestUser extends Omit<
  JwtUserInfoInterface,
  'sub'
> {
  sub: JwtUserInfoInterface['sub'] | string
}

/** CurrentUser 装饰器与鉴权守卫共享的请求 owner type。 */
export interface CurrentUserRequest extends FastifyRequest {
  user?: CurrentUserRequestUser
}
