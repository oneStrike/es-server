/**
 *  类型定义 [CreateNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type CreateNoticeRequest = CreateNoticeDto;

export type CreateNoticeResponse = IdDto;

/**
 *  类型定义 [NoticePageRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type NoticePageRequest = {
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

  /* 通知标题 */
  title?: string;

  /* 通知类型 */
  noticeType?: number;

  /* 优先级 */
  priorityLevel?: number;

  /* 发布开始时间 */
  publishStartTime?: string;

  /* 发布结束时间 */
  publishEndTime?: string;

  /* 关联页面代码 */
  pageCode?: string;

  /* 是否发布 */
  isPublished?: boolean;

  /* 是否置顶 */
  isPinned?: boolean;

  /* 是否弹窗显示 */
  showAsPopup?: boolean;

  /** 任意合法数值 */
  [property: string]: any;
};

export type NoticePageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: NoticePageResponseDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [NoticeDetailRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type NoticeDetailRequest = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type NoticeDetailResponse = BaseNoticeDto;

/**
 *  类型定义 [UpdateNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateNoticeRequest = UpdateNoticeDto;

export type UpdateNoticeResponse = IdDto;

/**
 *  类型定义 [BatchUpdateNoticeStatusRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type BatchUpdateNoticeStatusRequest = UpdateNoticeStatusDto;

export type BatchUpdateNoticeStatusResponse = CountDto;

/**
 *  类型定义 [BatchDeleteNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type BatchDeleteNoticeRequest = IdsDto;

export type BatchDeleteNoticeResponse = CountDto;

/**
 *  类型定义 [CreateNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type CreateNoticeDto = {
  /* 通知标题 */
  title: string;
  /* 通知内容详情 */
  content: string;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 排序权重（数值越大越靠前） */
  order?: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [NoticePageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type NoticePageResponseDto = {
  /* 通知ID */
  id: number;
  /* 通知标题 */
  title: string;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 是否发布 */
  isPublished: boolean;
  /* 启用的平台 */
  enablePlatform: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 阅读次数 */
  readCount?: number;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [BaseNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type BaseNoticeDto = {
  /* 通知ID */
  id: number;
  /* 通知标题 */
  title: string;
  /* 通知内容详情 */
  content: string;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 是否发布 */
  isPublished: boolean;
  /* 启用的平台 */
  enablePlatform: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 阅读次数 */
  readCount?: number;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateNoticeDto = {
  /* 通知标题 */
  title: string;
  /* 通知内容详情 */
  content: string;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateNoticeStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateNoticeStatusDto = {
  /* 是否发布 */
  isPublished: boolean;
  /* 主键id集合 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
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
 *  @更新时间 2025-10-24 11:07:47
 */
export type IdsDto = {
  /* 主键id集合 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};
