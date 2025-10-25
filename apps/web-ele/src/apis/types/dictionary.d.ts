/**
 *  类型定义 [DictionaryPageRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryPageRequest = {
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

  /* 字典名称（模糊查询） */
  name?: string;

  /* 字典编码（模糊查询） */
  code?: string;

  /* 状态筛选 */
  isEnabled?: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

export type DictionaryPageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: DictionaryDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [DictionaryDetailRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryDetailRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type DictionaryDetailResponse = DictionaryDto;

/**
 *  类型定义 [DictionaryCreateRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryCreateRequest = CreateDictionaryDto;

export type DictionaryCreateResponse = IdDto;

/**
 *  类型定义 [DictionaryUpdateRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryUpdateRequest = UpdateDictionaryDto;

export type DictionaryUpdateResponse = IdDto;

/**
 *  类型定义 [DictionaryDeleteRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryDeleteRequest = IdsDto;

export type DictionaryDeleteResponse = IdsDto;

/**
 *  类型定义 [DictionaryBatchUpdateStatusRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryBatchUpdateStatusRequest = BatchEnabledDto;

export type DictionaryBatchUpdateStatusResponse = CountDto;

/**
 *  类型定义 [DictionaryItemsRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryItemsRequest = {
  /* 字典编码 */
  dictionaryCode: string;

  /* 字典项名称（模糊查询） */
  name?: string;

  /* 字典项编码（模糊查询） */
  code?: string;

  /* 状态筛选 */
  isEnabled?: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

export type DictionaryItemsResponse = DictionaryItemDto[];

/**
 *  类型定义 [DictionaryCreateItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryCreateItemRequest = CreateDictionaryItemDto;

export type DictionaryCreateItemResponse = IdDto;

/**
 *  类型定义 [DictionaryUpdateItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryUpdateItemRequest = UpdateDictionaryItemDto;

export type DictionaryUpdateItemResponse = IdDto;

/**
 *  类型定义 [DictionaryDeleteItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryDeleteItemRequest = IdsDto;

export type DictionaryDeleteItemResponse = CountDto;

/**
 *  类型定义 [DictionaryUpdateItemStatusRequest]
 *  @来源 字典管理
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryUpdateItemStatusRequest = BatchEnabledDto;

export type DictionaryUpdateItemStatusResponse = CountDto;

/**
 *  类型定义 [DictionaryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryDto = {
  /* 字典ID */
  id: number;
  /* 字典名称 */
  name: string;
  /* 字典编码 */
  code: string;
  /* 字典封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled: boolean;
  /* 备注信息 */
  description?: string;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CreateDictionaryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type CreateDictionaryDto = {
  /* 字典名称 */
  name: string;
  /* 字典编码 */
  code: string;
  /* 字典封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean;
  /* 备注信息 */
  description?: string;

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
 *  类型定义 [UpdateDictionaryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type UpdateDictionaryDto = {
  /* 主键id */
  id: number;
  /* 字典名称 */
  name?: string;
  /* 字典编码 */
  code?: string;
  /* 字典封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean;
  /* 备注信息 */
  description?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type IdsDto = {
  /* 主键id集合 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [BatchEnabledDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type BatchEnabledDto = {
  /* 主键id集合 */
  ids: number[];
  /* 启用或者禁用 */
  isEnabled: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [DictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type DictionaryItemDto = {
  /* 字典项ID */
  id: number;
  /* 字典编码 */
  dictionaryCode: string;
  /* 字典项名称 */
  name: string;
  /* 字典项编码 */
  code: string;
  /* 排序 */
  order?: number;
  /* 字典项封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled: boolean;
  /* 备注信息 */
  description?: string;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CreateDictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type CreateDictionaryItemDto = {
  /* 字典编码 */
  dictionaryCode: string;
  /* 字典项名称 */
  name: string;
  /* 字典项编码 */
  code: string;
  /* 排序 */
  order?: number;
  /* 字典项封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean;
  /* 备注信息 */
  description?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateDictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-26 01:15:40
 */
export type UpdateDictionaryItemDto = {
  /* 字典编码 */
  dictionaryCode: string;
  /* 字典项名称 */
  name: string;
  /* 字典项编码 */
  code: string;
  /* 排序 */
  order?: number;
  /* 字典项封面 */
  cover?: string;
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean;
  /* 备注信息 */
  description?: string;
  /* 字典项ID */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};
