/**
 *  类型定义 [ComicChapterCreateRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterCreateRequest = CreateComicChapterDto;

export type ComicChapterCreateResponse = IdDto;

/**
 *  类型定义 [ComicChapterPageRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 漫画ID（精确匹配） */
  comicId: number;

  /* 结束时间 */
  endDate?: string;

  /* 是否为试读章节 */
  isPreview?: boolean;

  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished?: boolean;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule?: number;

  /* 开始时间 */
  startDate?: string;

  /* 章节标题（模糊搜索） */
  title?: string;

  /* 关联的漫画版本ID */
  versionId?: number;
};

export type ComicChapterPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: ComicChapterPageResponseDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [ComicChapterDetailRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type ComicChapterDetailResponse = ComicChapterDetailDto;

/**
 *  类型定义 [ComicChapterUpdateRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterUpdateRequest = UpdateComicChapterDto;

export type ComicChapterUpdateResponse = IdDto;

/**
 *  类型定义 [ComicChapterBatchDeleteRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterBatchDeleteRequest = IdsDto;

export type ComicChapterBatchDeleteResponse = BatchOperationResponseDto;

/**
 *  类型定义 [ComicChapterBatchUpdateStatusRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterBatchUpdateStatusRequest =
  UpdateChapterPublishStatusDto;

export type ComicChapterBatchUpdateStatusResponse = BatchOperationResponseDto;

/**
 *  类型定义 [ComicChapterSwapNumbersRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterSwapNumbersRequest = DragReorderDto;

export type ComicChapterSwapNumbersResponse = DragReorderDto;

/**
 *  类型定义 [ComicChapterContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterContentsRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type ComicChapterContentsResponse = string[];

/**
 *  类型定义 [ComicChapterAddContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterAddContentRequest = AddChapterContentDto;

export type ComicChapterAddContentResponse = string[];

/**
 *  类型定义 [ComicChapterUpdateContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterUpdateContentRequest = UpdateChapterContentDto;

export type ComicChapterUpdateContentResponse = string[];

/**
 *  类型定义 [ComicChapterDeleteContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterDeleteContentRequest = DeleteChapterContentDto;

export type ComicChapterDeleteContentResponse = string[];

/**
 *  类型定义 [ComicChapterMoveContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterMoveContentRequest = MoveChapterContentDto;

export type ComicChapterMoveContentResponse = string[];

/**
 *  类型定义 [ComicChapterBatchUpdateContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterBatchUpdateContentsRequest =
  BatchUpdateChapterContentsDto;

export type ComicChapterBatchUpdateContentsResponse = string[];

/**
 *  类型定义 [ComicChapterClearContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterClearContentsRequest = IdDto;

export type ComicChapterClearContentsResponse = IdDto;

/**
 *  类型定义 [CreateComicChapterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type CreateComicChapterDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 关联的漫画ID */
  comicId: number;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 管理员备注 */
  remark?: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 章节标题 */
  title: string;

  /* 关联的漫画版本ID */
  versionId?: number;
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
 *  类型定义 [ComicChapterPageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterPageResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 关联的漫画ID */
  comicId: number;
  /* 评论数 */
  commentCount: number;
  /* 创建时间 */
  createdAt: string;
  /* 章节ID */
  id: number;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished: boolean;
  /* 点赞数 */
  likeCount: number;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 章节标题 */
  title: string;
  /* 更新时间 */
  updatedAt: string;
  /* 关联的漫画版本ID */
  versionId?: number;

  /* 阅读次数 */
  viewCount: number;
};

/**
 *  类型定义 [ComicChapterDetailDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type ComicChapterDetailDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 关联的漫画ID */
  comicId: number;
  /* 评论数 */
  commentCount: number;
  /* 漫画内容（JSON格式存储图片URL数组） */
  contents: string;
  /* 创建时间 */
  createdAt: string;
  /* 章节ID */
  id: number;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished: boolean;
  /* 点赞数 */
  likeCount: number;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 关联的漫画信息 */
  relatedComic: RelatedComicDto;
  /* 关联的漫画版本信息 */
  relatedVersion: RelatedVersionDto;
  /* 管理员备注 */
  remark?: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 章节标题 */
  title: string;
  /* 更新时间 */
  updatedAt: string;
  /* 关联的漫画版本ID */
  versionId?: number;

  /* 阅读次数 */
  viewCount: number;
};

/**
 *  类型定义 [RelatedComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type RelatedComicDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 漫画ID */
  id: number;

  /* 漫画名字 */
  name: string;
};

/**
 *  类型定义 [RelatedVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type RelatedVersionDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 版本ID */
  id: number;
  /* 版本语言 */
  language: string;

  /* 版本名字 */
  versionName: string;
};

/**
 *  类型定义 [UpdateComicChapterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type UpdateComicChapterDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 章节序号（用于排序） */
  chapterNumber?: number;
  /* 关联的漫画ID */
  comicId?: number;
  /* 漫画内容（JSON格式存储图片URL数组） */
  contents?: string;
  /* 主键id */
  id: number;
  /* 是否为试读章节 */
  isPreview?: boolean;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished?: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule?: 0 | 1 | 2 | 3;
  /* 管理员备注 */
  remark?: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 章节标题 */
  title?: string;

  /* 关联的漫画版本ID */
  versionId?: number;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type IdsDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id集合 */
  ids: number[];
};

/**
 *  类型定义 [BatchOperationResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BatchOperationResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据量 */
  count: number;
};

/**
 *  类型定义 [UpdateChapterPublishStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type UpdateChapterPublishStatusDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 章节ID列表 */
  ids: number[];

  /* 发布状态（true: 发布, false: 取消发布） */
  isPublished: boolean;
};

/**
 *  类型定义 [DragReorderDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type DragReorderDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 当前拖拽元素的id */
  dragId: number;

  /* 拖拽的目标位置id */
  targetId: number;
};

/**
 *  类型定义 [AddChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type AddChapterContentDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 要添加的内容（图片URL） */
  content: string;
  /* 主键id */
  id: number;

  /* 插入位置索引（可选，默认添加到末尾） */
  index?: number;
};

/**
 *  类型定义 [UpdateChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type UpdateChapterContentDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 要添加的内容（图片URL） */
  content: string;
  /* 主键id */
  id: number;

  /* 插入位置索引（可选，默认添加到末尾） */
  index: number;
};

/**
 *  类型定义 [DeleteChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type DeleteChapterContentDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  id: number;

  /* 插入位置索引（可选，默认添加到末尾） */
  index: number;
};

/**
 *  类型定义 [MoveChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type MoveChapterContentDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 源索引位置 */
  fromIndex: number;
  /* 主键id */
  id: number;

  /* 目标索引位置 */
  toIndex: number;
};

/**
 *  类型定义 [BatchUpdateChapterContentsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BatchUpdateChapterContentsDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 新的内容数组（JSON格式） */
  contents: string[];

  /* 主键id */
  id: number;
};
