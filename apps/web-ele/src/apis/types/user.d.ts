export type GetCaptchaResponse = CaptchaDto;

/**
 *  类型定义 [UserLoginRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserLoginRequest = UserLoginDto;

export type UserLoginResponse = LoginResponseDto;

/**
 *  类型定义 [UserLogoutRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserLogoutRequest = TokenDto;

export type UserLogoutResponse = boolean;

/**
 *  类型定义 [UserRegisterRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserRegisterRequest = UserRegisterDto;

export type UserRegisterResponse = IdDto;

/**
 *  类型定义 [UserRefreshTokenRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserRefreshTokenRequest = RefreshTokenDto;

export type UserRefreshTokenResponse = RefreshTokenResponseDto;

/**
 *  类型定义 [UserUpdatePasswordRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserUpdatePasswordRequest = UpdatePasswordDto;

export type UserUpdatePasswordResponse = UserDto;

/**
 *  类型定义 [UserUpdateInfoRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserUpdateInfoRequest = UpdateUserDto;

export type UserUpdateInfoResponse = UserDto;

export type UserInfoResponse = UserDto;

/**
 *  类型定义 [UserInfoByIdRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserInfoByIdRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type UserInfoByIdResponse = UserDto;

/**
 *  类型定义 [UserPageRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserPageRequest = {
  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 当前页码 */
  pageIndex?: number;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 开始时间 */
  startDate?: string;

  /* 结束时间 */
  endDate?: string;

  /* 用户名 */
  username?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /* 角色 0普通管理员 1超级管理员 */
  role?: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type UserPageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: UserDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UserDeleteRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserDeleteRequest = IdDto;

export type UserDeleteResponse = IdDto;

/**
 *  类型定义 [CaptchaDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
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
 *  @更新时间 2025-10-14 23:15:29
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
 *  @更新时间 2025-10-14 23:15:29
 */
export type LoginResponseDto = {
  /* 令牌信息 */
  tokens: TokenDto;
  /* 用户信息 */
  user: UserDto;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [TokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
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
 *  类型定义 [UserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserDto = {
  /* 用户ID */
  id: number;
  /* 用户名 */
  username: string;
  /* 手机号 */
  mobile: string;
  /* 头像 */
  avatar?: string;
  /* 是否启用 */
  isEnabled: boolean;
  /* 角色 0普通管理员 1超级管理员 */
  role: number;
  /* 最后登录时间 */
  lastLoginAt?: string;
  /* 最后登录IP */
  lastLoginIp?: string;
  /* 登录失败次数 */
  loginFailCount: number;
  /* 是否锁定 */
  isLocked: boolean;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UserRegisterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type UserRegisterDto = {
  /* 用户名 */
  username: string;
  /* 手机号 */
  mobile: string;
  /* 头像 */
  avatar?: string;
  /* 角色 0普通管理员 1超级管理员 */
  role: number;
  /* 密码 */
  password: string;
  /* 密码 */
  confirmPassword: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [RefreshTokenDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type RefreshTokenDto = {
  /* 刷新令牌 */
  refreshToken: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [RefreshTokenResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type RefreshTokenResponseDto = {
  /* 刷新令牌响应 */
  tokens: TokenDto;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdatePasswordDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type UpdatePasswordDto = {
  /* 刷新令牌 */
  refreshToken: string;
  /* 密码 */
  oldPassword: string;
  /* 密码 */
  newPassword: string;
  /* 密码 */
  confirmPassword: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateUserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 23:15:29
 */
export type UpdateUserDto = {
  /* 用户名 */
  username: string;
  /* 手机号 */
  mobile: string;
  /* 头像 */
  avatar?: string;
  /* 用户ID */
  id?: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 角色 0普通管理员 1超级管理员 */
  role?: number;

  /** 任意合法数值 */
  [property: string]: any;
};
