export type AuthPublicKeyResponse = RsaPublicKeyDto;

export type AuthCaptchaResponse = CaptchaDto;

/**
 *  类型定义 [AuthLoginRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type AuthLoginRequest = UserLoginDto;

export type AuthLoginResponse = LoginResponseDto;

/**
 *  类型定义 [AuthLogoutRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type AuthLogoutRequest = TokenDto;

export type AuthLogoutResponse = boolean;

/**
 *  类型定义 [AuthRefreshTokenRequest]
 *  @来源 管理端认证模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type AuthRefreshTokenRequest = RefreshTokenDto;

export type AuthRefreshTokenResponse = TokenDto;

/**
 *  类型定义 [RsaPublicKeyDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
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
 *  @更新时间 2025-12-04 21:43:06
 */
export type CaptchaDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 验证码 */
  captcha: string;

  /* 验证码ID */
  captchaId: string;
};

/**
 *  类型定义 [UserLoginDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
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
 *  @更新时间 2025-12-04 21:43:06
 */
export type LoginResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 令牌信息 */
  tokens: TokenDto;

  /* 用户信息 */
  user: BaseUserDto;
};

/**
 *  类型定义 [TokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
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
 *  类型定义 [BaseUserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BaseUserDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 头像 */
  avatar?: string;
  /* 创建时间 */
  createdAt: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled: boolean;
  /* 是否锁定 */
  isLocked: boolean;
  /* 最后登录时间 */
  lastLoginAt?: string;
  /* 最后登录IP */
  lastLoginIp?: string;
  /* 手机号 */
  mobile: string;
  /* 角色 0普通管理员 1超级管理员 */
  role: 0 | 1;
  /* 更新时间 */
  updatedAt: string;

  /* 用户名 */
  username: string;
};

/**
 *  类型定义 [RefreshTokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type RefreshTokenDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 刷新令牌 */
  refreshToken: string;
};
