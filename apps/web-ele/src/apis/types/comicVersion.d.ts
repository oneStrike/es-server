/**
 *  类型定义 [CreateComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type CreateComicVersionRequest = CreateComicVersionDto

export type CreateComicVersionResponse = IdDto

/**
 *  类型定义 [ComicVersionPageRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type ComicVersionPageRequest = {
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

  /* 漫画ID（精确匹配） */
  comicId: number

  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language?: string

  /* 翻译组名称（模糊搜索） */
  translatorGroup?: string

  /* 是否为推荐版本 */
  isRecommended?: boolean

  /* 发布状态 */
  isPublished?: boolean

  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule?: number

  /* 版本名称（模糊搜索） */
  versionName?: string

  /** 任意合法数值 */
  [property: string]: any
}

export type ComicVersionPageResponse = {
  /* 当前页码 */
  pageIndex?: number

  /* 每页条数 */
  pageSize?: number

  /* 总条数 */
  total?: number

  /* 列表数据 */
  list?: BaseComicVersionDto[]

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [ComicVersionDetailRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type ComicVersionDetailRequest = {
  /* 主键id */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

export type ComicVersionDetailResponse = ComicVersionDetailResponseDto

/**
 *  类型定义 [UpdateComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type UpdateComicVersionRequest = UpdateComicVersionDto

export type UpdateComicVersionResponse = IdDto

/**
 *  类型定义 [BatchUpdateVersionPublishStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type BatchUpdateVersionPublishStatusRequest = BatchPublishDto

export type BatchUpdateVersionPublishStatusResponse = CountDto

/**
 *  类型定义 [BatchUpdateVersionRecommendedStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type BatchUpdateVersionRecommendedStatusRequest = UpdateVersionRecommendedStatusDto

export type BatchUpdateVersionRecommendedStatusResponse = CountDto

/**
 *  类型定义 [BatchUpdateVersionEnabledStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type BatchUpdateVersionEnabledStatusRequest = UpdateVersionEnabledStatusDto

export type BatchUpdateVersionEnabledStatusResponse = CountDto

/**
 *  类型定义 [DeleteComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-15 22:51:06
 */
export type DeleteComicVersionRequest = IdDto

export type DeleteComicVersionResponse = IdDto

/**
 *  类型定义 [CreateComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type CreateComicVersionDto = {
  /* 关联的原始漫画ID */
  comicId: number
  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string
  /* 翻译组/汉化组名称 */
  translatorGroup?: string
  /* 版本描述 */
  description?: string
  /* 是否为推荐版本 */
  isRecommended: boolean
  /* 发布时间 */
  publishAt?: string
  /* 最后更新时间 */
  lastUpdated?: string
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3
  /* 购买需要消耗的积分 */
  purchaseAmount: number
  /* 版权信息 */
  copyright?: string
  /* 免责声明 */
  disclaimer?: string
  /* 备注（内部使用） */
  remark?: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type IdDto = {
  /* 主键id */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [BaseComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type BaseComicVersionDto = {
  /* 版本ID */
  id: number
  /* 关联的原始漫画ID */
  comicId: number
  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string
  /* 翻译组/汉化组名称 */
  translatorGroup?: string
  /* 版本描述 */
  description?: string
  /* 是否为推荐版本 */
  isRecommended: boolean
  /* 发布状态 */
  isPublished: boolean
  /* 发布时间 */
  publishAt?: string
  /* 最后更新时间 */
  lastUpdated?: string
  /* 总阅读次数 */
  totalViews: number
  /* 收藏数 */
  favoriteCount: number
  /* 点赞数 */
  likeCount: number
  /* 评分（1-10分，保留一位小数） */
  rating?: number
  /* 评分人数 */
  ratingCount: number
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3
  /* 购买需要消耗的积分 */
  purchaseAmount: number
  /* 版权信息 */
  copyright?: string
  /* 免责声明 */
  disclaimer?: string
  /* 备注（内部使用） */
  remark?: string
  /* 排序权重（用于版本列表排序） */
  sortOrder: number
  /* 创建时间 */
  createdAt: string
  /* 更新时间 */
  updatedAt: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [ComicVersionDetailResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type ComicVersionDetailResponseDto = {
  /* 版本ID */
  id: number
  /* 关联的原始漫画ID */
  comicId: number
  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string
  /* 翻译组/汉化组名称 */
  translatorGroup?: string
  /* 版本描述 */
  description?: string
  /* 是否为推荐版本 */
  isRecommended: boolean
  /* 发布状态 */
  isPublished: boolean
  /* 发布时间 */
  publishAt?: string
  /* 最后更新时间 */
  lastUpdated?: string
  /* 总阅读次数 */
  totalViews: number
  /* 收藏数 */
  favoriteCount: number
  /* 点赞数 */
  likeCount: number
  /* 评分（1-10分，保留一位小数） */
  rating?: number
  /* 评分人数 */
  ratingCount: number
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3
  /* 购买需要消耗的积分 */
  purchaseAmount: number
  /* 版权信息 */
  copyright?: string
  /* 免责声明 */
  disclaimer?: string
  /* 备注（内部使用） */
  remark?: string
  /* 排序权重（用于版本列表排序） */
  sortOrder: number
  /* 创建时间 */
  createdAt: string
  /* 更新时间 */
  updatedAt: string

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [UpdateComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type UpdateComicVersionDto = {
  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName?: string
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language?: string
  /* 翻译组/汉化组名称 */
  translatorGroup?: string
  /* 版本描述 */
  description?: string
  /* 是否为推荐版本 */
  isRecommended?: boolean
  /* 发布状态 */
  isPublished?: boolean
  /* 发布时间 */
  publishAt?: string
  /* 最后更新时间 */
  lastUpdated?: string
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule?: 0 | 1 | 2 | 3
  /* 购买需要消耗的积分 */
  purchaseAmount?: number
  /* 版权信息 */
  copyright?: string
  /* 免责声明 */
  disclaimer?: string
  /* 备注（内部使用） */
  remark?: string
  /* 排序权重（用于版本列表排序） */
  sortOrder?: number
  /* 主键id */
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [BatchPublishDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type BatchPublishDto = {
  /* 主键id */
  ids: number[]
  /* 发布或者取消发布 */
  isPublished: boolean

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [UpdateVersionRecommendedStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type UpdateVersionRecommendedStatusDto = {
  /* 主键id */
  ids: number[]
  /* 启用或者禁用 */
  isEnabled: boolean
  /* 推荐状态 */
  isRecommended: boolean

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [UpdateVersionEnabledStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:06
 */
export type UpdateVersionEnabledStatusDto = {
  /* 主键id */
  ids: number[]
  /* 启用或者禁用 */
  isEnabled: boolean

  /** 任意合法数值 */
  [property: string]: any
}