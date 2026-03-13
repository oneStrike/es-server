/**
 * 认证通用常量
 * 覆盖令牌注销原因与错误文案
 */

/**
 * 创建认证 Redis Key 生成器
 * @param prefix - 应用前缀 (如 'admin' 或 'app')
 */
export function createAuthRedisKeys (prefix: string) {
  return {
  /** 登录失败计数 Key */
  LOGIN_FAIL_COUNT: (id: number) => `${prefix}:auth:login:fail:${id}`,
  /** 账号锁定 Key */
  LOGIN_LOCK: (id: number) => `${prefix}:auth:login:lock:${id}`,
}
}

/**
 * 认证通用常量
 */
export const AuthConstants = {
  /** 最大登录失败尝试次数 */
  LOGIN_MAX_ATTEMPTS: 5,
  /** 失败计数过期时间（秒）：5分钟 */
  LOGIN_FAIL_TTL: 5 * 60,
  /** 账号锁定时间（秒）：30分钟 */
  ACCOUNT_LOCK_TTL: 30 * 60,
}

/**
 * 认证默认值
 */
export const AuthDefaultValue = {
  /** 未知 IP 标识 */
  IP_ADDRESS_UNKNOWN: 'unknown',
}

/**
 * 令牌注销原因枚举
 */
export enum RevokeTokenReasonEnum {
  /** 密码变更 */
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  /** 用户主动注销 */
  USER_LOGOUT = 'USER_LOGOUT',
  /** 管理员主动注销 */
  ADMIN_REVOKE = 'ADMIN_REVOKE',
  /** 安全问题答案错误 */
  SECURITY = 'SECURITY',
  /** 令牌过期 */
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
}

/**
 * 对外抛出的错误信息常量
 */
export const AuthErrorConstant = {
  /** 登录失效 */
  LOGIN_INVALID: '登录失效，请重新登录！',
  /** 账号异地登录 */
  ACCOUNT_LOGGED_IN: '账号已在其他设备登录，请重新登录！',
}
