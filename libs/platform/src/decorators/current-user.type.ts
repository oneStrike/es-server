import type { JwtUserInfoInterface } from '@libs/platform/types'

/** CurrentUser 装饰器支持读取的 JWT 用户字段名。 */
export type UserField = keyof JwtUserInfoInterface
