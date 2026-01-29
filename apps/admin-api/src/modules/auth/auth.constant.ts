/**
 * 管理端认证模块常量
 */
export enum CacheKey {
  CAPTCHA = 'admin:auth:login:captcha:',
}

export const AuthConstants = {
  /** 最大登录失败尝试次数 */
  LOGIN_MAX_ATTEMPTS: 5,
  /** 失败计数过期时间（秒）：5分钟 */
  LOGIN_FAIL_TTL: 5 * 60,
  /** 账号锁定时间（秒）：30分钟 */
  ACCOUNT_LOCK_TTL: 30 * 60,
}

export const AuthRedisKeys = {
  /** 登录失败计数 Key */
  LOGIN_FAIL_COUNT: (id: number) => `admin:auth:login:fail:${id}`,
  /** 登录锁定 Key */
  LOGIN_LOCK: (id: number) => `admin:auth:login:lock:${id}`,
}
