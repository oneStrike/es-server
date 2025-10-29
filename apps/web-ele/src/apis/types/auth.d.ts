export type AuthPublicKeyResponse = RsaPublicKeyDto;

export type AuthCaptchaResponse = CaptchaDto;

/**
 *  类型定义 [AuthLoginRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type AuthLoginRequest = UserLoginDto;

export type AuthLoginResponse = LoginResponseDto;

/**
 *  类型定义 [AuthLogoutRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type AuthLogoutRequest = TokenDto;

export type AuthLogoutResponse = boolean;

/**
 *  类型定义 [AuthRefreshTokenRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type AuthRefreshTokenRequest = RefreshTokenDto;

export type AuthRefreshTokenResponse = TokenDto;

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type RsaPublicKeyDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* RSA公钥 */
  publicKey: string;
};

/**
 *  类型定义 [CaptchaDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type CaptchaDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 验证码 */
  data: string;

  /* 验证码 key */
  id: string;
};

/**
 *  类型定义 [UserLoginDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UserLoginDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 验证码 */
  captcha: string;
  /* 验证码ID */
  captchaId: string;
  /* 密码 */
  password: string;

  /* 用户名 */
  username: string;
};

/**
 *  类型定义 [LoginResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type LoginResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 令牌信息 */
  tokens: TokenDto;

  /* 用户信息 */
  user: Record<string, any>;
};

/**
 *  类型定义 [TokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type TokenDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 账号令牌 */
  accessToken: string;

  /* 刷新令牌 */
  refreshToken: string;
};

/**
 *  类型定义 [RefreshTokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type RefreshTokenDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 刷新令牌 */
  refreshToken: string;
};
