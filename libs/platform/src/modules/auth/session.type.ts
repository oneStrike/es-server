import type { ClientRequestContext } from '@libs/platform/utils'

/** 会话链路使用的客户端上下文，供 token 持久化与刷新链路复用。 */
export type SessionClientContext = ClientRequestContext

/** 认证链路签发的 access/refresh token 对。 */
export interface AuthTokenPair {
  accessToken: string
  refreshToken: string
}

/** 退出登录时需要撤销的 token 对。 */
export type AuthLogoutTokenPair = AuthTokenPair

/** 退出登录的持久化撤销选项。 */
export interface AuthLogoutOptions {
  revokeDbTokens?: boolean
}
