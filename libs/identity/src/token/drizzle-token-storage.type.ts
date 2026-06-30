import type { adminUserToken, appUserToken } from '@db/schema'

/** Drizzle token storage 支持的 token 表集合，兼容 app 与 admin 两类登录态。 */
export type TokenTable = typeof appUserToken | typeof adminUserToken
