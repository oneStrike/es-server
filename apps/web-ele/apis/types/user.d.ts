export type GetCaptchaResponse = CaptchaDto;

/**
 *  类型定义 [UserLoginRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserLoginRequest = UserLoginDto;

export type UserLoginResponse = LoginResponseDto;

/**
 *  类型定义 [UserLogoutRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserLogoutRequest = TokenDto;

export type UserLogoutResponse = boolean;

/**
 *  类型定义 [UserRegisterRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserRegisterRequest = UserRegisterDto;

export type UserRegisterResponse = IdDto;

/**
 *  类型定义 [UserRefreshTokenRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserRefreshTokenRequest = RefreshTokenDto;

export type UserRefreshTokenResponse = RefreshTokenResponseDto;

/**
 *  类型定义 [UserUpdatePasswordRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserUpdatePasswordRequest = UpdatePasswordDto;

export type UserUpdatePasswordResponse = UserDto;

/**
 *  类型定义 [UserUpdateInfoRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserUpdateInfoRequest = UpdateUserDto;

export type UserUpdateInfoResponse = UserDto;

export type UserInfoResponse = UserDto;

/**
 *  类型定义 [UserInfoByIdRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserInfoByIdRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type UserInfoByIdResponse = UserDto;

/**
 *  类型定义 [UserPageRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 结束时间 */
  endDate?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 角色 0普通管理员 1超级管理员 */
  role?: number;

  /* 开始时间 */
  startDate?: string;

  /* 用户名 */
  username?: string;
};

export type UserPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: UserDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [UserDeleteRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserDeleteRequest = IdDto;

export type UserDeleteResponse = IdDto;

/**
 *  类型定义 [CaptchaDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
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
 *  @更新时间 2025-09-29 10:18:47
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
 *  @更新时间 2025-09-29 10:18:47
 */
export type LoginResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 令牌信息 */
  tokens: TokenDto;

  /* 用户信息 */
  user: UserDto;
};

/**
 *  类型定义 [TokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
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
 *  类型定义 [UserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 头像 */
  avatar?: string;
  /* 创建时间 */
  createdAt: string;
  /* 用户ID */
  id: number;
  /* 是否启用 */
  isEnabled: boolean;
  /* 是否锁定 */
  isLocked: boolean;
  /* 最后登录时间 */
  lastLoginAt?: string;
  /* 最后登录IP */
  lastLoginIp?: string;
  /* 登录失败次数 */
  loginFailCount: number;
  /* 手机号 */
  mobile: string;
  /* 角色 0普通管理员 1超级管理员 */
  role: number;
  /* 更新时间 */
  updatedAt: string;

  /* 用户名 */
  username: string;
};

/**
 *  类型定义 [UserRegisterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type UserRegisterDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 头像 */
  avatar?: string;
  /* 密码 */
  confirmPassword: string;
  /* 手机号 */
  mobile: string;
  /* 密码 */
  password: string;
  /* 角色 0普通管理员 1超级管理员 */
  role: number;

  /* 用户名 */
  username: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [RefreshTokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type RefreshTokenDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 刷新令牌 */
  refreshToken: string;
};

/**
 *  类型定义 [RefreshTokenResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type RefreshTokenResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 刷新令牌响应 */
  tokens: TokenDto;
};

/**
 *  类型定义 [UpdatePasswordDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type UpdatePasswordDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 密码 */
  confirmPassword: string;
  /* 密码 */
  newPassword: string;
  /* 密码 */
  oldPassword: string;

  /* 刷新令牌 */
  refreshToken: string;
};

/**
 *  类型定义 [UpdateUserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-09-29 10:18:47
 */
export type UpdateUserDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 头像 */
  avatar?: string;
  /* 用户ID */
  id?: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 手机号 */
  mobile: string;
  /* 角色 0普通管理员 1超级管理员 */
  role?: number;

  /* 用户名 */
  username: string;
};
