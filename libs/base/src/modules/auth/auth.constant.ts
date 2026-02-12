/**
 * 认证通用常量
 * 覆盖令牌注销原因与错误文案
 */
/// 令牌注销原因枚举
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

/// 对外抛出的错误信息常量
export const AuthErrorConstant = {
  /** 登录失效 */
  LOGIN_INVALID: '登录失效，请重新登录！',
  /** 账号异地登录 */
  ACCOUNT_LOGGED_IN: '账号已在其他设备登录，请重新登录！',
}
