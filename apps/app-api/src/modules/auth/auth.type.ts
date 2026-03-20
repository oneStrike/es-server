/**
 * 应用端登录入参。
 * 用于认证服务处理账号/手机号登录与验证码登录的稳定输入结构。
 */
export interface AppLoginInput {
  account?: string
  phone?: string
  code?: string
  password?: string
}

/**
 * 应用端令牌对入参。
 * 用于登出等需要同时持有 accessToken 与 refreshToken 的场景。
 */
export interface AppTokenPairInput {
  accessToken: string
  refreshToken: string
}

/**
 * 应用端刷新令牌入参。
 * 用于刷新访问令牌时传递 refreshToken。
 */
export interface AppRefreshTokenInput {
  refreshToken: string
}

/**
 * 应用端找回密码入参。
 * 包含手机号验证码校验与新密码字段。
 */
export interface AppForgotPasswordInput {
  phone: string
  code: string
  password: string
}

/**
 * 应用端修改密码入参。
 * 包含旧密码、新密码与确认密码三项安全字段。
 */
export interface AppChangePasswordInput {
  oldPassword: string
  newPassword: string
  confirmNewPassword: string
}

/**
 * 应用端发送短信验证码入参。
 * 用于选择手机号与模板代码后调用短信网关。
 */
export interface AppSendVerifyCodeInput {
  phone: string
  templateCode?: string
}

/**
 * 应用端校验短信验证码入参。
 * 用于按手机号和验证码校验一次性口令。
 */
export interface AppCheckVerifyCodeInput {
  phone: string
  code: string
}
