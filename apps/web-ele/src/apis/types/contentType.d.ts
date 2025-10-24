/**
 *  类型定义 [CreateContentTypeRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type CreateContentTypeRequest = CreateContentTypeDto;

export type CreateContentTypeResponse = IdDto;

/**
 *  类型定义 [UpdateContentTypeRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateContentTypeRequest = UpdateContentTypeDto;

export type UpdateContentTypeResponse = IdDto;

/**
 *  类型定义 [ContentTypeListRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type ContentTypeListRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code?: string;

  /* 结束时间 */
  endDate?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 开始时间 */
  startDate?: string;
};

export type ContentTypeListResponse = BaseContentTypeDto[];

/**
 *  类型定义 [CreateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type CreateContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name: string;
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
 *  类型定义 [UpdateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code?: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name?: string;
};

/**
 *  类型定义 [BaseContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type BaseContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 创建时间 */
  createdAt?: string;
  /* ID */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 显示名称 */
  name: string;

  /* 更新时间 */
  updatedAt?: string;
};
