/**
 *  类型定义 [CreateComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateComicVersionRequest = CreateComicVersionDto;

export type CreateComicVersionResponse = IdDto;

/**
 *  类型定义 [ComicVersionPageRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type ComicVersionPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 漫画ID（精确匹配） */
  comicId: number;

  /* 结束时间 */
  endDate?: string;

  /* 发布状态 */
  isPublished?: boolean;

  /* 是否为推荐版本 */
  isRecommended?: boolean;

  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule?: number;

  /* 开始时间 */
  startDate?: string;

  /* 翻译组名称（模糊搜索） */
  translatorGroup?: string;

  /* 版本名称（模糊搜索） */
  versionName?: string;
};

export type ComicVersionPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: BaseComicVersionDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [ComicVersionDetailRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type ComicVersionDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type ComicVersionDetailResponse = ComicVersionDetailResponseDto;

/**
 *  类型定义 [UpdateComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateComicVersionRequest = UpdateComicVersionDto;

export type UpdateComicVersionResponse = IdDto;

/**
 *  类型定义 [BatchUpdateVersionPublishStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchUpdateVersionPublishStatusRequest = BatchPublishDto;

export type BatchUpdateVersionPublishStatusResponse = CountDto;

/**
 *  类型定义 [BatchUpdateVersionRecommendedStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchUpdateVersionRecommendedStatusRequest =
  UpdateVersionRecommendedStatusDto;

export type BatchUpdateVersionRecommendedStatusResponse = CountDto;

/**
 *  类型定义 [BatchUpdateVersionEnabledStatusRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchUpdateVersionEnabledStatusRequest =
  UpdateVersionEnabledStatusDto;

export type BatchUpdateVersionEnabledStatusResponse = CountDto;

/**
 *  类型定义 [DeleteComicVersionRequest]
 *  @来源 漫画版本管理模块
 *  @更新时间 2025-08-23 16:01:23
 */
export type DeleteComicVersionRequest = IdDto;

export type DeleteComicVersionResponse = IdDto;

/**
 *  类型定义 [CreateComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type CreateComicVersionDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 关联的原始漫画ID */
  comicId: number;
  /* 版权信息 */
  copyright?: string;
  /* 版本描述 */
  description?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 是否为推荐版本 */
  isRecommended: boolean;
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount: number;
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 备注（内部使用） */
  remark?: string;
  /* 翻译组/汉化组名称 */
  translatorGroup?: string;

  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [BaseComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type BaseComicVersionDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 关联的原始漫画ID */
  comicId: number;
  /* 版权信息 */
  copyright?: string;
  /* 创建时间 */
  createdAt: string;
  /* 版本描述 */
  description?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 收藏数 */
  favoriteCount: number;
  /* 版本ID */
  id: number;
  /* 发布状态 */
  isPublished: boolean;
  /* 是否为推荐版本 */
  isRecommended: boolean;
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 点赞数 */
  likeCount: number;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount: number;
  /* 评分（1-10分，保留一位小数） */
  rating?: number;
  /* 评分人数 */
  ratingCount: number;
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 备注（内部使用） */
  remark?: string;
  /* 排序权重（用于版本列表排序） */
  sortOrder: number;
  /* 总阅读次数 */
  totalViews: number;
  /* 翻译组/汉化组名称 */
  translatorGroup?: string;
  /* 更新时间 */
  updatedAt: string;

  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string;
};

/**
 *  类型定义 [ComicVersionDetailResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type ComicVersionDetailResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 关联的原始漫画ID */
  comicId: number;
  /* 版权信息 */
  copyright?: string;
  /* 创建时间 */
  createdAt: string;
  /* 版本描述 */
  description?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 收藏数 */
  favoriteCount: number;
  /* 版本ID */
  id: number;
  /* 发布状态 */
  isPublished: boolean;
  /* 是否为推荐版本 */
  isRecommended: boolean;
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 点赞数 */
  likeCount: number;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount: number;
  /* 评分（1-10分，保留一位小数） */
  rating?: number;
  /* 评分人数 */
  ratingCount: number;
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 备注（内部使用） */
  remark?: string;
  /* 排序权重（用于版本列表排序） */
  sortOrder: number;
  /* 总阅读次数 */
  totalViews: number;
  /* 翻译组/汉化组名称 */
  translatorGroup?: string;
  /* 更新时间 */
  updatedAt: string;

  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName: string;
};

/**
 *  类型定义 [UpdateComicVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateComicVersionDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 版权信息 */
  copyright?: string;
  /* 版本描述 */
  description?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 主键id */
  id: number;
  /* 发布状态 */
  isPublished?: boolean;
  /* 是否为推荐版本 */
  isRecommended?: boolean;
  /* 语言代码（如：zh-CN, en-US, ja-JP） */
  language?: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 查看规则（0=所有人, 1=登录用户, 2=会员, 3=积分购买） */
  readRule?: 0 | 1 | 2 | 3;
  /* 备注（内部使用） */
  remark?: string;
  /* 排序权重（用于版本列表排序） */
  sortOrder?: number;
  /* 翻译组/汉化组名称 */
  translatorGroup?: string;

  /* 版本名称（如：英语版、日语版、XX汉化组等） */
  versionName?: string;
};

/**
 *  类型定义 [BatchPublishDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type BatchPublishDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  ids: number[];

  /* 发布或者取消发布 */
  isPublished: boolean;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type CountDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据数量 */
  count: number;
};

/**
 *  类型定义 [UpdateVersionRecommendedStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateVersionRecommendedStatusDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  ids: number[];
  /* 启用或者禁用 */
  isEnabled: boolean;

  /* 推荐状态 */
  isRecommended: boolean;
};

/**
 *  类型定义 [UpdateVersionEnabledStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type UpdateVersionEnabledStatusDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  ids: number[];

  /* 启用或者禁用 */
  isEnabled: boolean;
};
