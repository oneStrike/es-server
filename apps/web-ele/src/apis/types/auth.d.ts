export type PublicKeyResponse = RsaPublicKeyDto;

export type CaptchaResponse = CaptchaDto;

/**
 *  类型定义 [LoginRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type LoginRequest = UserLoginDto;

export type LoginResponse = LoginResponseDto;

/**
 *  类型定义 [LogoutRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type LogoutRequest = TokenDto;

export type LogoutResponse = boolean;

/**
 *  类型定义 [RefreshTokenRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type RefreshTokenRequest = RefreshTokenDto;

export type RefreshTokenResponse = TokenDto;

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
 */
export type RefreshTokenDto = {
  /* 刷新令牌 */
  refreshToken: string;

  /** 任意合法数值 */
  [property: string]: any;
};
