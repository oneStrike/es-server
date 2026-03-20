/**
 * 管理端登录入参。
 * 用于认证服务处理验证码与账号密码登录校验。
 */
export interface AdminLoginInput {
  captchaId: string
  captcha: string
  username: string
  password: string
}

/**
 * 管理端令牌对入参。
 * 用于退出登录等需要传入双令牌的场景。
 */
export interface AdminTokenPairInput {
  accessToken: string
  refreshToken: string
}

/**
 * 管理端刷新令牌入参。
 * 用于访问令牌续期时传递 refreshToken。
 */
export interface AdminRefreshTokenInput {
  refreshToken: string
}
