export type RoleTypeListResponse = RoleTypeListResponseDto[];

export type RoleTypeCreateResponse = IdDto;

export type RoleTypeDeleteResponse = IdDto;

export type RoleTypeUpdateResponse = IdDto;

export type RoleTypeChangeStatusResponse = IdDto;

/**
 *  类型定义 [RoleTypeListResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type RoleTypeListResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 角色代码 */
  code: string;
  /* 创建时间 */
  createdAt: string;
  /* 角色描述 */
  description?: string;
  /* 主键id */
  id: number;
  /* 角色名称 */
  name: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};
