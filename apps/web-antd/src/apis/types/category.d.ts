/**
 *  类型定义 [CreateCategoryRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type CreateCategoryRequest = CreateCategoryDto;

export type CreateCategoryResponse = IdDto;

/**
 *  类型定义 [CategoryPageRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type CategoryPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 应用类型 */
  contentTypes?: number;

  /* 结束时间 */
  endDate?: string;

  /* 是否启用 */
  isEnabled?: boolean;

  /* 分类名称 */
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

export type CategoryPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: BaseCategoryDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [CategoryDetailRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type CategoryDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type CategoryDetailResponse = BaseCategoryDto;

/**
 *  类型定义 [UpdateCategoryRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type UpdateCategoryRequest = UpdateCategoryDto;

export type UpdateCategoryResponse = IdDto;

/**
 *  类型定义 [BatchUpdateCategoryStatusRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type BatchUpdateCategoryStatusRequest = BatchEnabledDto;

export type BatchUpdateCategoryStatusResponse = CountDto;

export type DeleteBatchResponse = CountDto;

/**
 *  类型定义 [CategoryOrderRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type CategoryOrderRequest = OrderDto;

export type CategoryOrderResponse = OrderDto;

/**
 *  类型定义 [CreateCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type CreateCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 应用类型 */
  contentTypes: number;
  /* 分类图标URL */
  icon?: string;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name: string;

  /* 排序值 */
  order?: number;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [BaseCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type BaseCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画数量 */
  comicCount?: number;
  /* 应用类型 */
  contentTypes: number;
  /* 创建时间 */
  createdAt?: string;
  /* 分类图标URL */
  icon?: string;
  /* 分类ID */
  id: number;
  /* 插画数量 */
  illustrationCount?: number;
  /* 图片数量 */
  imageSetCount?: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name: string;
  /* 小说数量 */
  novelCount?: number;
  /* 排序值 */
  order?: number;
  /* 人气值 */
  popularity?: number;
  /* 辅助人气值 */
  popularityWeight?: number;

  /* 更新时间 */
  updatedAt?: string;
};

/**
 *  类型定义 [UpdateCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type UpdateCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 应用类型 */
  contentTypes?: number;
  /* 分类图标URL */
  icon?: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name?: string;
  /* 排序值 */
  order?: number;
  /* 人气值 */
  popularity?: number;

  /* 辅助人气值 */
  popularityWeight?: number;
};

/**
 *  类型定义 [BatchEnabledDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type BatchEnabledDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  ids: number[];

  /* 启用或者禁用 */
  isEnabled: boolean;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type CountDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据数量 */
  count: number;
};

/**
 *  类型定义 [OrderDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type OrderDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 当前拖拽数据的id */
  dragId: number;

  /* 拖拽的目标id */
  targetId: number;
};
