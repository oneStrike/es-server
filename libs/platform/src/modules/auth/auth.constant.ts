/**
 * 认证通用常量
 * 覆盖令牌注销原因与错误文案
 */

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
  /** 刷新令牌轮换 */
  TOKEN_REFRESH = 'TOKEN_REFRESH',
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
export const AuthErrorMessages = {
  /** 登录失效 */
  LOGIN_INVALID: '登录失效，请重新登录！',
  /** 账号异地登录 */
  ACCOUNT_LOGGED_IN: '账号已在其他设备登录，请重新登录！',
}
