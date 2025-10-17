/**
 *  类型定义 [ComicPageRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type ComicPageRequest = {
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

  /* 漫画名称（模糊搜索） */
  name?: string;

  /* 语言代码 */
  language?: string;

  /* 地区代码 */
  region?: string;

  /* 年龄分级 */
  ageRating?: string;

  /* 发布状态 */
  isPublished?: boolean;

  /* 连载状态 */
  serialStatus?: number;

  /* 阅读规则 */
  readRule?: number;

  /* 是否推荐 */
  isRecommended?: boolean;

  /* 是否热门 */
  isHot?: boolean;

  /* 是否新作 */
  isNew?: boolean;

  /* 作者名称 */
  author?: string;

  /* 出版社（模糊搜索） */
  publisher?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ComicPageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: BaseComicDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CreateComicRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type CreateComicRequest = CreateComicDto;

export type CreateComicResponse = IdDto;

/**
 *  类型定义 [ComicDetailRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type ComicDetailRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ComicDetailResponse = BaseComicDto;

/**
 *  类型定义 [UpdateComicRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicRequest = UpdateComicDto;

export type UpdateComicResponse = IdDto;

/**
 *  类型定义 [BatchUpdateComicStatusRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type BatchUpdateComicStatusRequest = UpdateComicStatusDto;

export type BatchUpdateComicStatusResponse = CountDto;

/**
 *  类型定义 [BatchUpdateComicRecommendedRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type BatchUpdateComicRecommendedRequest = UpdateComicRecommendedDto;

export type BatchUpdateComicRecommendedResponse = CountDto;

/**
 *  类型定义 [BatchUpdateComicHotRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type BatchUpdateComicHotRequest = UpdateComicHotDto;

export type BatchUpdateComicHotResponse = CountDto;

/**
 *  类型定义 [BatchUpdateComicNewRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type BatchUpdateComicNewRequest = UpdateComicNewDto;

export type BatchUpdateComicNewResponse = CountDto;

/**
 *  类型定义 [DeleteComicRequest]
 *  @来源 漫画管理模块
 *  @更新时间 2025-10-15 22:09:38
 */
export type DeleteComicRequest = IdDto;

export type DeleteComicResponse = IdDto;

/**
 *  类型定义 [BaseComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type BaseComicDto = {
  /* 漫画ID */
  id: number;
  /* 漫画名称 */
  name: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 漫画封面URL */
  cover: string;
  /* 漫画分类 */
  comicCategories: ComicCategoryDto[];
  /* 漫画作者 */
  comicAuthors: ComicAuthorDto[];
  /* 热度值（用于排序） */
  popularity: number;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 语言代码 */
  language: string;
  /* 地区代码 */
  region: string;
  /* 年龄分级 */
  ageRating: string;
  /* 发布状态 */
  isPublished: boolean;
  /* 发布日期 */
  publishAt?: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 漫画简介 */
  description: string;
  /* 出版社 */
  publisher?: string;
  /* 原始来源 */
  originalSource?: string;
  /* 连载状态 */
  serialStatus: 0 | 1 | 2 | 3;
  /* 是否允许下载 */
  canDownload: boolean;
  /* 是否允许评论 */
  canComment: boolean;
  /* 阅读规则 */
  readRule: 0 | 1 | 2 | 3;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 总章节数 */
  totalChapters: number;
  /* 总阅读次数 */
  totalViews: number;
  /* 收藏数 */
  favoriteCount: number;
  /* 评论总数 */
  commentCount: number;
  /* 点赞总数 */
  likeCount: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* 评分人数 */
  ratingCount: number;
  /* SEO标题 */
  seoTitle?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 是否推荐 */
  isRecommended: boolean;
  /* 是否热门 */
  isHot: boolean;
  /* 是否新作 */
  isNew: boolean;
  /* 版权信息 */
  copyright?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 管理员备注 */
  remark?: string;
  /* 软删除时间 */
  deletedAt?: string;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ComicCategoryDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type ComicCategoryDto = {
  /* 分类ID */
  id: number;
  /* 分类名称 */
  name: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ComicAuthorDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type ComicAuthorDto = {
  /* 作者ID */
  id: number;
  /* 作者名称 */
  name: string;
  /* 是否为主要作者 */
  isPrimary: boolean;
  /* 排序 */
  sortOrder: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CreateComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type CreateComicDto = {
  /* 漫画名称 */
  name: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 漫画封面URL */
  cover: string;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 语言代码 */
  language: string;
  /* 地区代码 */
  region: string;
  /* 年龄分级 */
  ageRating: string;
  /* 发布日期 */
  publishAt?: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 漫画简介 */
  description: string;
  /* 出版社 */
  publisher?: string;
  /* 原始来源 */
  originalSource?: string;
  /* 连载状态 */
  serialStatus: 0 | 1 | 2 | 3;
  /* 是否允许下载 */
  canDownload: boolean;
  /* 是否允许评论 */
  canComment: boolean;
  /* 阅读规则 */
  readRule: 0 | 1 | 2 | 3;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* SEO标题 */
  seoTitle?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 版权信息 */
  copyright?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 管理员备注 */
  remark?: string;
  /* 关联的作者ID列表 */
  authorIds: number[];
  /* 关联的分类ID列表 */
  categoryIds: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicDto = {
  /* 漫画名称 */
  name?: string;
  /* 漫画别名（支持多别名，用逗号分隔） */
  alias?: string;
  /* 漫画封面URL */
  cover?: string;
  /* 热度值（用于排序） */
  popularity?: number;
  /* 虚拟热度热度权重（影响热度计算） */
  popularityWeight?: number;
  /* 语言代码 */
  language?: string;
  /* 地区代码 */
  region?: string;
  /* 年龄分级 */
  ageRating?: string;
  /* 发布状态 */
  isPublished?: boolean;
  /* 发布日期 */
  publishAt?: string;
  /* 最后更新时间 */
  lastUpdated?: string;
  /* 漫画简介 */
  description?: string;
  /* 出版社 */
  publisher?: string;
  /* 原始来源 */
  originalSource?: string;
  /* 连载状态 */
  serialStatus?: 0 | 1 | 2 | 3;
  /* 是否允许下载 */
  canDownload?: boolean;
  /* 是否允许评论 */
  canComment?: boolean;
  /* 阅读规则 */
  readRule?: 0 | 1 | 2 | 3;
  /* 所需积分 */
  purchaseAmount?: number;
  /* 总章节数 */
  totalChapters?: number;
  /* 评分（1-10分，保留1位小数） */
  rating?: number;
  /* SEO标题 */
  seoTitle?: string;
  /* SEO描述 */
  seoDescription?: string;
  /* SEO关键词 */
  seoKeywords?: string;
  /* 推荐权重（影响推荐排序） */
  recommendWeight?: number;
  /* 是否推荐 */
  isRecommended?: boolean;
  /* 是否热门 */
  isHot?: boolean;
  /* 是否新作 */
  isNew?: boolean;
  /* 版权信息 */
  copyright?: string;
  /* 免责声明 */
  disclaimer?: string;
  /* 管理员备注 */
  remark?: string;
  /* 主键id */
  id: number;
  /* 关联的作者ID列表（可选，传入则更新关联关系） */
  authorIds?: number[];
  /* 关联的分类ID列表（可选，传入则更新关联关系） */
  categoryIds?: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicStatusDto = {
  /* 发布状态 */
  isPublished: boolean;
  /* 漫画ID列表 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicRecommendedDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicRecommendedDto = {
  /* 是否推荐 */
  isRecommended: boolean;
  /* 漫画ID列表 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicHotDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicHotDto = {
  /* 是否热门 */
  isHot: boolean;
  /* 漫画ID列表 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicNewDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-15 22:09:38
 */
export type UpdateComicNewDto = {
  /* 是否新作 */
  isNew: boolean;
  /* 漫画ID列表 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};
