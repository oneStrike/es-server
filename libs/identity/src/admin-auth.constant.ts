import { createAuthRedisKeys } from '@libs/platform/modules/auth/helpers'

export enum AdminAuthCacheKeys {
  /** 登录验证码 Key 前缀 */
  CAPTCHA = 'admin:auth:login:captcha:',
}

/** 管理端账号认证与登录保护共用的 Redis key。 */
export const AdminAuthRedisKeys = createAuthRedisKeys('admin')
