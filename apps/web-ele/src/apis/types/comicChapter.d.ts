/**
 *  类型定义 [CreateComicChapterRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type CreateComicChapterRequest = CreateComicChapterDto;

export type CreateComicChapterResponse = IdDto;

/**
 *  类型定义 [ComicChapterPageRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type ComicChapterPageRequest = {
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

  /* 章节标题（模糊搜索） */
  title?: string;

  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished?: boolean;

  /* 关联的漫画版本ID */
  versionId?: number;

  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule?: number;

  /* 是否为试读章节 */
  isPreview?: boolean;

  /* 漫画ID（精确匹配） */
  comicId: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ComicChapterPageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: ComicChapterPageResponseDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ComicChapterDetailRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type ComicChapterDetailRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ComicChapterDetailResponse = ComicChapterDetailDto;

/**
 *  类型定义 [UpdateComicChapterRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type UpdateComicChapterRequest = UpdateComicChapterDto;

export type UpdateComicChapterResponse = IdDto;

/**
 *  类型定义 [BatchUpdateChapterPublishStatusRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type BatchUpdateChapterPublishStatusRequest =
  UpdateChapterPublishStatusDto;

export type BatchUpdateChapterPublishStatusResponse = CountDto;

/**
 *  类型定义 [BatchDeleteComicChapterRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type BatchDeleteComicChapterRequest = IdsDto;

export type BatchDeleteComicChapterResponse = CountDto;

/**
 *  类型定义 [SwapChapterNumbersRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type SwapChapterNumbersRequest = OrderDto;

export type SwapChapterNumbersResponse = OrderDto;

/**
 *  类型定义 [ChapterContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type ChapterContentsRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ChapterContentsResponse = string[];

/**
 *  类型定义 [AddChapterContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type AddChapterContentRequest = AddChapterContentDto;

export type AddChapterContentResponse = string[];

/**
 *  类型定义 [UpdateChapterContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type UpdateChapterContentRequest = UpdateChapterContentDto;

export type UpdateChapterContentResponse = string[];

/**
 *  类型定义 [DeleteChapterContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type DeleteChapterContentRequest = DeleteChapterContentDto;

export type DeleteChapterContentResponse = string[];

/**
 *  类型定义 [MoveChapterContentRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type MoveChapterContentRequest = MoveChapterContentDto;

export type MoveChapterContentResponse = string[];

/**
 *  类型定义 [BatchUpdateChapterContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type BatchUpdateChapterContentsRequest = BatchUpdateChapterContentsDto;

export type BatchUpdateChapterContentsResponse = string[];

/**
 *  类型定义 [ClearChapterContentsRequest]
 *  @来源 漫画章节管理模块
 *  @更新时间 2025-10-14 22:09:57
 */
export type ClearChapterContentsRequest = IdDto;

export type ClearChapterContentsResponse = IdDto;

/**
 *  类型定义 [CreateComicChapterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type CreateComicChapterDto = {
  /* 章节标题 */
  title: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 关联的漫画ID */
  comicId: number;
  /* 关联的漫画版本ID */
  versionId?: number;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 管理员备注 */
  remark?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ComicChapterPageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type ComicChapterPageResponseDto = {
  /* 章节ID */
  id: number;
  /* 章节标题 */
  title: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished: boolean;
  /* 关联的漫画ID */
  comicId: number;
  /* 关联的漫画版本ID */
  versionId?: number;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 阅读次数 */
  viewCount: number;
  /* 点赞数 */
  likeCount: number;
  /* 评论数 */
  commentCount: number;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ComicChapterDetailDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type ComicChapterDetailDto = {
  /* 章节ID */
  id: number;
  /* 章节标题 */
  title: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished: boolean;
  /* 关联的漫画ID */
  comicId: number;
  /* 关联的漫画版本ID */
  versionId?: number;
  /* 章节序号（用于排序） */
  chapterNumber: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule: 0 | 1 | 2 | 3;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 漫画内容（JSON格式存储图片URL数组） */
  contents: string;
  /* 是否为试读章节 */
  isPreview: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 阅读次数 */
  viewCount: number;
  /* 点赞数 */
  likeCount: number;
  /* 评论数 */
  commentCount: number;
  /* 管理员备注 */
  remark?: string;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;
  /* 关联的漫画信息 */
  relatedComic: RelatedComicDto;
  /* 关联的漫画版本信息 */
  relatedVersion: RelatedVersionDto;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [RelatedComicDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type RelatedComicDto = {
  /* 漫画ID */
  id: number;
  /* 漫画名字 */
  name: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [RelatedVersionDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type RelatedVersionDto = {
  /* 版本ID */
  id: number;
  /* 版本名字 */
  versionName: string;
  /* 版本语言 */
  language: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateComicChapterDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type UpdateComicChapterDto = {
  /* 章节标题 */
  title?: string;
  /* 章节副标题或描述 */
  subtitle?: string;
  /* 发布状态（true: 已发布, false: 未发布） */
  isPublished?: boolean;
  /* 关联的漫画ID */
  comicId?: number;
  /* 关联的漫画版本ID */
  versionId?: number;
  /* 章节序号（用于排序） */
  chapterNumber?: number;
  /* 查看规则（0: 公开, 1: 登录, 2: 会员, 3: 购买） */
  readRule?: 0 | 1 | 2 | 3;
  /* 购买需要消耗的积分 */
  purchaseAmount?: number;
  /* 漫画内容（JSON格式存储图片URL数组） */
  contents?: string;
  /* 是否为试读章节 */
  isPreview?: boolean;
  /* 发布时间 */
  publishAt?: string;
  /* 章节缩略图 */
  thumbnail?: string;
  /* 管理员备注 */
  remark?: string;
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateChapterPublishStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type UpdateChapterPublishStatusDto = {
  /* 章节ID列表 */
  ids: number[];
  /* 发布状态（true: 发布, false: 取消发布） */
  isPublished: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type IdsDto = {
  /* 主键id */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [OrderDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type OrderDto = {
  /* 拖拽的目标id */
  targetId: number;
  /* 当前拖拽数据的id */
  dragId: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [AddChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type AddChapterContentDto = {
  /* 主键id */
  id: number;
  /* 要添加的内容（图片URL） */
  content: string;
  /* 插入位置索引（可选，默认添加到末尾） */
  index?: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type UpdateChapterContentDto = {
  /* 主键id */
  id: number;
  /* 要添加的内容（图片URL） */
  content: string;
  /* 插入位置索引（可选，默认添加到末尾） */
  index: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [DeleteChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type DeleteChapterContentDto = {
  /* 主键id */
  id: number;
  /* 插入位置索引（可选，默认添加到末尾） */
  index: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [MoveChapterContentDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type MoveChapterContentDto = {
  /* 主键id */
  id: number;
  /* 源索引位置 */
  fromIndex: number;
  /* 目标索引位置 */
  toIndex: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [BatchUpdateChapterContentsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type BatchUpdateChapterContentsDto = {
  /* 主键id */
  id: number;
  /* 新的内容数组（JSON格式） */
  contents: string[];

  /** 任意合法数值 */
  [property: string]: any;
};
