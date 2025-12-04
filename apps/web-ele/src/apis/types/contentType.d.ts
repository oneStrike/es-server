/**
 *  类型定义 [ContentTypeCreateRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ContentTypeCreateRequest = CreateContentTypeDto;

export type ContentTypeCreateResponse = IdDto;

/**
 *  类型定义 [ContentTypeListRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ContentTypeListRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name?: string;
};

export type ContentTypeListResponse = BaseContentTypeDto[];

/**
 *  类型定义 [ContentTypeUpdateRequest]
 *  @来源 内容类型管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ContentTypeUpdateRequest = UpdateContentTypeDto;

export type ContentTypeUpdateResponse = IdDto;

/**
 *  类型定义 [CreateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type CreateContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 分类描述 */
  description?: string;
  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name: string;
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

/**
 *  类型定义 [BaseContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BaseContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 创建时间 */
  createdAt: string;
  /* 分类描述 */
  description?: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 显示名称 */
  name: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [UpdateContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type UpdateContentTypeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 类型编码（唯一，如：COMIC/NOVEL/ILLUSTRATION/ALBUM） */
  code: string;
  /* 分类描述 */
  description?: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;

  /* 显示名称 */
  name: string;
};
