/**
 *  类型定义 [DictionaryPageRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type DictionaryPageRequest = {
  /* 单页大小，最大500，默认15 */
  pageSize?: number

  /* 当前页码 */
  pageIndex?: number

  /* 排序字段，json格式 */
  orderBy?: string

  /* 开始时间 */
  startDate?: string

  /* 结束时间 */
  endDate?: string

  /* 字典名称（模糊查询） */
  name?: string

  /* 字典编码（模糊查询） */
  code?: string

  /* 状态筛选 */
  isEnabled?: boolean

  /** 任意合法数值 */
  [property: string]: any
}

export type DictionaryPageResponse = {
  /* 当前页码 */
  pageIndex?: number

  /* 每页条数 */
  pageSize?: number

  /* 总条数 */
  total?: number

  /* 列表数据 */
  list?: DictionaryDto[]

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [DictionaryDetailRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type DictionaryDetailRequest = {
  /* 主键id */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

export type DictionaryDetailResponse = DictionaryDto

/**
 *  类型定义 [CreateDictionaryRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateDictionaryRequest = CreateDictionaryDto

export type CreateDictionaryResponse = IdDto

/**
 *  类型定义 [UpdateDictionaryRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateDictionaryRequest = DictionaryDto

export type UpdateDictionaryResponse = IdDto

/**
 *  类型定义 [DeleteDictionaryRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type DeleteDictionaryRequest = IdsDto

export type DeleteDictionaryResponse = IdsDto

/**
 *  类型定义 [BatchUpdateDictionaryStatusRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchUpdateDictionaryStatusRequest = BatchEnabledDto

export type BatchUpdateDictionaryStatusResponse = CountDto

/**
 *  类型定义 [DictionaryItemsRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type DictionaryItemsRequest = {
  /* 字典编码 */
  dictionaryCode: string

  /* 字典项名称（模糊查询） */
  name?: string

  /* 字典项编码（模糊查询） */
  code?: string

  /* 状态筛选 */
  isEnabled?: boolean

  /** 任意合法数值 */
  [property: string]: any
}

export type DictionaryItemsResponse = DictionaryItemDto[]

/**
 *  类型定义 [CreateDictionaryItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateDictionaryItemRequest = CreateDictionaryItemDto

export type CreateDictionaryItemResponse = IdDto

/**
 *  类型定义 [UpdateDictionaryItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateDictionaryItemRequest = UpdateDictionaryItemDto

export type UpdateDictionaryItemResponse = IdDto

/**
 *  类型定义 [DeleteDictionaryItemRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type DeleteDictionaryItemRequest = IdsDto

export type DeleteDictionaryItemResponse = CountDto

/**
 *  类型定义 [UpdateDictionaryItemStatusRequest]
 *  @来源 字典管理
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateDictionaryItemStatusRequest = BatchEnabledDto

export type UpdateDictionaryItemStatusResponse = CountDto

/**
 *  类型定义 [DictionaryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type DictionaryDto = {
  /* 字典ID */
  id: number
  /* 字典名称 */
  name: string
  /* 字典编码 */
  code: string
  /* 字典封面 */
  cover?: string
  /* 状态 true启用 false禁用 */
  isEnabled: boolean
  /* 备注信息 */
  remark?: string
  /* 创建时间 */
  createdAt: string
  /* 更新时间 */
  updatedAt: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [CreateDictionaryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateDictionaryDto = {
  /* 字典名称 */
  name: string
  /* 字典编码 */
  code: string
  /* 字典封面 */
  cover?: string
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean
  /* 备注信息 */
  remark?: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type IdDto = {
  /* 主键id */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type IdsDto = {
  /* 主键id */
  ids: number[]

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [BatchEnabledDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchEnabledDto = {
  /* 主键id */
  ids: number[]
  /* 启用或者禁用 */
  isEnabled: boolean

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [DictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type DictionaryItemDto = {
  /* 字典项ID */
  id: number
  /* 字典编码 */
  dictionaryCode: string
  /* 字典项名称 */
  name: string
  /* 字典项编码 */
  code: string
  /* 排序 */
  order?: number
  /* 字典项封面 */
  cover?: string
  /* 状态 true启用 false禁用 */
  isEnabled: boolean
  /* 备注信息 */
  remark?: string
  /* 创建时间 */
  createdAt: string
  /* 更新时间 */
  updatedAt: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [CreateDictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateDictionaryItemDto = {
  /* 字典编码 */
  dictionaryCode: string
  /* 字典项名称 */
  name: string
  /* 字典项编码 */
  code: string
  /* 排序 */
  order?: number
  /* 字典项封面 */
  cover?: string
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean
  /* 备注信息 */
  remark?: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [UpdateDictionaryItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateDictionaryItemDto = {
  /* 字典编码 */
  dictionaryCode: string
  /* 字典项名称 */
  name: string
  /* 字典项编码 */
  code: string
  /* 排序 */
  order?: number
  /* 字典项封面 */
  cover?: string
  /* 状态 true启用 false禁用 */
  isEnabled?: boolean
  /* 备注信息 */
  remark?: string
  /* 字典项ID */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}