/**
 *  类型定义 [CategoryCreateRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryCreateRequest = CreateCategoryDto;

export type CategoryCreateResponse = IdDto;

/**
 *  类型定义 [CategoryPageRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 作品媒介代码数组 JSON 字符串 */
  contentType?: string;

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
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type CategoryDetailResponse = BaseCategoryDto;

/**
 *  类型定义 [CategoryUpdateRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryUpdateRequest = UpdateCategoryDto;

export type CategoryUpdateResponse = IdDto;

/**
 *  类型定义 [CategoryBatchUpdateStatusRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryBatchUpdateStatusRequest = BatchEnabledDto;

export type CategoryBatchUpdateStatusResponse = BatchOperationResponseDto;

/**
 *  类型定义 [CategoryBatchDeleteRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryBatchDeleteRequest = IdsDto;

export type CategoryBatchDeleteResponse = BatchOperationResponseDto;

/**
 *  类型定义 [CategoryOrderRequest]
 *  @来源 分类管理模块
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryOrderRequest = DragReorderDto;

export type CategoryOrderResponse = DragReorderDto;

/**
 *  类型定义 [CreateCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type CreateCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 作品媒介代码数组（必填） */
  contentType: string[];
  /* 分类图标URL */
  icon?: string;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name: string;
  /* 排序值 */
  order?: number;

  /* 辅助人气值 */
  popularityWeight?: number;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
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
 *  @更新时间 2025-11-28 23:47:20
 */
export type BaseCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 分类包含的内容类型项数组 */
  categoryContentTypes: CategoryContentTypeItemDto[];
  /* 创建时间 */
  createdAt?: string;
  /* 分类图标URL */
  icon?: string;
  /* 分类ID */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name: string;
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
 *  类型定义 [CategoryContentTypeItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type CategoryContentTypeItemDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 分类ID */
  categoryId: number;
  /* 内容类型对象 */
  contentType: BaseContentTypeDto;

  /* 内容类型ID */
  contentTypeId: number;
};

/**
 *  类型定义 [BaseContentTypeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
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

/**
 *  类型定义 [UpdateCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type UpdateCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 作品媒介代码数组（必填） */
  contentType: string[];
  /* 分类图标URL */
  icon?: string;
  /* 主键id */
  id: number;
  /* 是否启用 */
  isEnabled?: boolean;
  /* 分类名称 */
  name: string;
  /* 排序值 */
  order?: number;

  /* 辅助人气值 */
  popularityWeight?: number;
};

/**
 *  类型定义 [BatchEnabledDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type BatchEnabledDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id集合 */
  ids: number[];

  /* 状态 true启用 false禁用 */
  isEnabled: boolean;
};

/**
 *  类型定义 [BatchOperationResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type BatchOperationResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据量 */
  count: number;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type IdsDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id集合 */
  ids: number[];
};

/**
 *  类型定义 [DragReorderDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type DragReorderDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 当前拖拽元素的id */
  dragId: number;

  /* 拖拽的目标位置id */
  targetId: number;
};
