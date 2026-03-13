/**
 * 管理端认证模块常量
 */
import { AuthConstants, createAuthRedisKeys } from '@libs/platform/modules/auth'

export enum CacheKey {
  /** 登录验证码 Key 前缀 */
  CAPTCHA = 'admin:auth:login:captcha:',
}

// 重新导出通用常量
export { AuthConstants }

// 创建管理端专用的 Redis Keys
export const AuthRedisKeys = createAuthRedisKeys('admin')
