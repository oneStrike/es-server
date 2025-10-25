export type AuthPublicKeyResponse = RsaPublicKeyDto;

export type AuthCaptchaResponse = CaptchaDto;

/**
 *  类型定义 [AuthLoginRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type AuthLoginRequest = UserLoginDto;

export type AuthLoginResponse = LoginResponseDto;

/**
 *  类型定义 [AuthLogoutRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type AuthLogoutRequest = TokenDto;

export type AuthLogoutResponse = boolean;

/**
 *  类型定义 [AuthRefreshTokenRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type AuthRefreshTokenRequest = RefreshTokenDto;

export type AuthRefreshTokenResponse = TokenDto;

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type RsaPublicKeyDto = {
  /* RSA公钥 */
  publicKey: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CaptchaDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type CaptchaDto = {
  /* 验证码 key */
  id: string;
  /* 验证码 */
  data: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UserLoginDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type UserLoginDto = {
  /* 用户名 */
  username: string;
  /* 密码 */
  password: string;
  /* 验证码 */
  captcha: string;
  /* 验证码ID */
  captchaId: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [LoginResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type LoginResponseDto = {
  /* 令牌信息 */
  tokens: TokenDto;
  /* 用户信息 */
  user: Record<string, any>;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [TokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type TokenDto = {
  /* 账号令牌 */
  accessToken: string;
  /* 刷新令牌 */
  refreshToken: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [RefreshTokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type RefreshTokenDto = {
  /* 刷新令牌 */
  refreshToken: string;

  /** 任意合法数值 */
  [property: string]: any;
};
