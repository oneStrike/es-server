/**
 *  类型定义 [ComicCreateRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicCreateRequest = CreateComicDto;

export type ComicCreateResponse = IdDto;

/**
 *  类型定义 [ComicPageRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 年龄分级 */
  ageRating?: string;

  /* 作者名称 */
  author?: string;

  /* 结束时间 */
  endDate?: string;

  /* 是否热门 */
  isHot?: boolean;

  /* 是否新作 */
  isNew?: boolean;

  /* 发布状态 */
  isPublished?: boolean;

  /* 是否推荐 */
  isRecommended?: boolean;

  /* 语言代码 */
  language?: string;

  /* 漫画名称（模糊搜索） */
  name?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 出版社（模糊搜索） */
  publisher?: string;

  /* 阅读规则 */
  readRule?: number;

  /* 地区代码 */
  region?: string;

  /* 连载状态 */
  serialStatus?: number;

  /* 开始时间 */
  startDate?: string;
};

export type ComicPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: BaseComicDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [ComicDetailRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type ComicDetailResponse = BaseComicDto;

/**
 *  类型定义 [ComicUpdateRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicUpdateRequest = UpdateComicDto;

export type ComicUpdateResponse = IdDto;

/**
 *  类型定义 [ComicBatchUpdateStatusRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicBatchUpdateStatusRequest = UpdateComicStatusDto;

export type ComicBatchUpdateStatusResponse = CountDto;

/**
 *  类型定义 [ComicBatchUpdateRecommendedRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicBatchUpdateRecommendedRequest = UpdateComicRecommendedDto;

export type ComicBatchUpdateRecommendedResponse = CountDto;

/**
 *  类型定义 [ComicBatchUpdateHotRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicBatchUpdateHotRequest = UpdateComicHotDto;

export type ComicBatchUpdateHotResponse = CountDto;

/**
 *  类型定义 [ComicBatchUpdateNewRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicBatchUpdateNewRequest = UpdateComicNewDto;

export type ComicBatchUpdateNewResponse = CountDto;

/**
 *  类型定义 [ComicDeleteRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicDeleteRequest = IdDto;

export type ComicDeleteResponse = IdDto;

/**
 *  类型定义 [CreateComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type CreateComicDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 年龄分级 */
  ageRating: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 关联的作者ID列表 */
  authorIds: number[];
  /* 是否允许评论 */
  canComment: boolean;
  /* 是否允许下载 */
  canDownload: boolean;
  /* 关联的分类ID列表 */
  categoryIds: number[];
  /* 版权信息 */
  copyright?: string;
  /* 漫画封面URL */
  cover: string;
  /* 漫画简介 */
  description: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 语言代码 */
  language: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 漫画名称 */
  name: string;
  /* 原始来源 */
  originalSource?: string;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 发布日期 */
  publishAt?: string;
  /* 出版社 */
  publisher?: string;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* 阅读规则 */
  readRule: 0 | 1 | 2 | 3;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 地区代码 */
  region: string;
  /* 管理员备注 */
  remark?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* SEO标题 */
  seoTitle?: string;

  /* 连载状态 */
  serialStatus: 0 | 1 | 2 | 3;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [BaseComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type BaseComicDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 年龄分级 */
  ageRating: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 是否允许评论 */
  canComment: boolean;
  /* 是否允许下载 */
  canDownload: boolean;
  /* 漫画作者 */
  comicAuthors: ComicAuthorDto[];
  /* 漫画分类 */
  comicCategories: ComicCategoryDto[];
  /* 评论总数 */
  commentCount: number;
  /* 版权信息 */
  copyright?: string;
  /* 漫画封面URL */
  cover: string;
  /* 创建时间 */
  createdAt: string;
  /* 软删除时间 */
  deletedAt?: string;
  /* 漫画简介 */
  description: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 收藏数 */
  favoriteCount: number;
  /* 漫画ID */
  id: number;
  /* 是否热门 */
  isHot: boolean;
  /* 是否新作 */
  isNew: boolean;
  /* 发布状态 */
  isPublished: boolean;
  /* 是否推荐 */
  isRecommended: boolean;
  /* 语言代码 */
  language: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 点赞总数 */
  likeCount: number;
  /* 漫画名称 */
  name: string;
  /* 原始来源 */
  originalSource?: string;
  /* 热度值（用于排序） */
  popularity: number;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 发布日期 */
  publishAt?: string;
  /* 出版社 */
  publisher?: string;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* 评分人数 */
  ratingCount: number;
  /* 阅读规则 */
  readRule: 0 | 1 | 2 | 3;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 地区代码 */
  region: string;
  /* 管理员备注 */
  remark?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* SEO标题 */
  seoTitle?: string;
  /* 连载状态 */
  serialStatus: 0 | 1 | 2 | 3;
  /* 总章节数 */
  totalChapters: number;
  /* 总阅读次数 */
  totalViews: number;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [ComicCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicCategoryDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 分类ID */
  id: number;

  /* 分类名称 */
  name: string;
};

/**
 *  类型定义 [ComicAuthorDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type ComicAuthorDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 作者ID */
  id: number;
  /* 是否为主要作者 */
  isPrimary: boolean;
  /* 作者名称 */
  name: string;

  /* 排序 */
  sortOrder: number;
};

/**
 *  类型定义 [UpdateComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UpdateComicDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 年龄分级 */
  ageRating?: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 关联的作者ID列表（可选，传入则更新关联关系） */
  authorIds?: number[];
  /* 是否允许评论 */
  canComment?: boolean;
  /* 是否允许下载 */
  canDownload?: boolean;
  /* 关联的分类ID列表（可选，传入则更新关联关系） */
  categoryIds?: number[];
  /* 版权信息 */
  copyright?: string;
  /* 漫画封面URL */
  cover?: string;
  /* 漫画简介 */
  description?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 主键id */
  id: number;
  /* 是否热门 */
  isHot?: boolean;
  /* 是否新作 */
  isNew?: boolean;
  /* 发布状态 */
  isPublished?: boolean;
  /* 是否推荐 */
  isRecommended?: boolean;
  /* 语言代码 */
  language?: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 漫画名称 */
  name?: string;
  /* 原始来源 */
  originalSource?: string;
  /* 热度值（用于排序） */
  popularity?: number;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 发布日期 */
  publishAt?: string;
  /* 出版社 */
  publisher?: string;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* 阅读规则 */
  readRule?: 0 | 1 | 2 | 3;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 地区代码 */
  region?: string;
  /* 管理员备注 */
  remark?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* SEO标题 */
  seoTitle?: string;
  /* 连载状态 */
  serialStatus?: 0 | 1 | 2 | 3;

  /* 总章节数 */
  totalChapters?: number;
};

/**
 *  类型定义 [UpdateComicStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UpdateComicStatusDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画ID列表 */
  ids: number[];

  /* 发布状态 */
  isPublished: boolean;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type CountDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据数量 */
  count: number;
};

/**
 *  类型定义 [UpdateComicRecommendedDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UpdateComicRecommendedDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画ID列表 */
  ids: number[];

  /* 是否推荐 */
  isRecommended: boolean;
};

/**
 *  类型定义 [UpdateComicHotDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UpdateComicHotDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画ID列表 */
  ids: number[];

  /* 是否热门 */
  isHot: boolean;
};

/**
 *  类型定义 [UpdateComicNewDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 08:54:44
 */
export type UpdateComicNewDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画ID列表 */
  ids: number[];

  /* 是否新作 */
  isNew: boolean;
};
