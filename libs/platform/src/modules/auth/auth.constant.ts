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
  /** 密码修改后强制下线 */
  PASSWORD_CHANGE = 1,
  /** 刷新令牌轮换导致旧令牌失效 */
  TOKEN_REFRESH = 2,
  /** 用户主动退出登录 */
  USER_LOGOUT = 3,
  /** 管理员主动强制下线 */
  ADMIN_REVOKE = 4,
  /** 命中安全风控后撤销 */
  SECURITY = 5,
  /** 令牌自然过期后回收 */
  TOKEN_EXPIRED = 6,
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
