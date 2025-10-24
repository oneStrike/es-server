/**
 *  类型定义 [RegisterRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type RegisterRequest = UserRegisterDto;

export type RegisterResponse = IdDto;

/**
 *  类型定义 [UpdateInfoRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateInfoRequest = UpdateUserDto;

export type UpdateInfoResponse = UserDto;

export type InfoResponse = UserDto;

/**
 *  类型定义 [InfoByIdRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type InfoByIdRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type InfoByIdResponse = UserDto;

/**
 *  类型定义 [PageRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type PageRequest = {
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

export type PageResponse = {
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
 *  类型定义 [DeleteRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type DeleteRequest = IdDto;

export type DeleteResponse = IdDto;

/**
 *  类型定义 [ChangePasswordRequest]
 *  @来源 管理端用户模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type ChangePasswordRequest = ChangePasswordDto;

export type ChangePasswordResponse = IdDto;

/**
 *  类型定义 [UserRegisterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [UpdateUserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
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

/**
 *  类型定义 [UserDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
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
 *  类型定义 [ChangePasswordDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type ChangePasswordDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 确认新密码 */
  confirmPassword: string;
  /* 新密码 */
  newPassword: string;

  /* 旧密码 */
  oldPassword: string;
};
