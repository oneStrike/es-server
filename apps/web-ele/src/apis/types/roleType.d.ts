export type RoleTypeListResponse = RoleTypeListResponseDto[];

/**
 *  类型定义 [RoleTypeListResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type RoleTypeListResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 角色代码 */
  code: string;
  /* 角色描述 */
  description?: string;
  /* 角色类型ID */
  id: number;

  /* 角色名称 */
  name: string;
};
