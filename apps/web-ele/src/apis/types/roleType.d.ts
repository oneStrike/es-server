export type RoleTypeListResponse = RoleTypeListResponseDto[];

/**
 *  类型定义 [RoleTypeListResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type RoleTypeListResponseDto = {
  /* 角色类型ID */
  id: number;
  /* 角色代码 */
  code: string;
  /* 角色名称 */
  name: string;
  /* 角色描述 */
  description?: string;

  /** 任意合法数值 */
  [property: string]: any;
};
