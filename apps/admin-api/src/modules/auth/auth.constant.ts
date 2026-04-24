import { createAuthRedisKeys } from '@libs/platform/modules/auth/helpers';

export enum AdminAuthCacheKeys {
  /** 登录验证码 Key 前缀 */
  CAPTCHA = 'admin:auth:login:captcha:',
}

// 创建管理端专用的 Redis Keys
export const AdminAuthRedisKeys = createAuthRedisKeys('admin')
