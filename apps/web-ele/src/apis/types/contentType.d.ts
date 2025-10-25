/**
 *  类型定义 [ContentTypeCreateRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type ContentTypeCreateRequest = CreateContentTypeDto;

export type ContentTypeCreateResponse = IdDto;

/**
 *  类型定义 [ContentTypeListRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type ContentTypeListRequest = {
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

  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code?: string;

  /* 显示名称 */
  name?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ContentTypeListResponse = BaseContentTypeDto[];

/**
 *  类型定义 [ContentTypeUpdateRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-10-26 01:15:40
 */
export type ContentTypeUpdateRequest = UpdateContentTypeDto;

export type ContentTypeUpdateResponse = IdDto;

/**
 *  类型定义 [CreateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type CreateContentTypeDto = {
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 显示名称 */
  name: string;
  /* 是否启用 */
  isEnabled?: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [BaseContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type BaseContentTypeDto = {
  /* ID */
  id: number;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 显示名称 */
  name: string;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 创建时间 */
  createdAt?: string;
  /* 更新时间 */
  updatedAt?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type UpdateContentTypeDto = {
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code?: string;
  /* 显示名称 */
  name?: string;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};
