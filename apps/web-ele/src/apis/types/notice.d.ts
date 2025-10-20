/**
 *  类型定义 [CreateNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type CreateNoticeRequest = CreateNoticeDto;

export type CreateNoticeResponse = IdDto;

/**
 *  类型定义 [NoticePageRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type NoticePageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 结束时间 */
  endDate?: string;

  /* 是否置顶 */
  isPinned?: boolean;

  /* 是否发布 */
  isPublished?: boolean;

  /* 通知类型 */
  noticeType?: number;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 关联页面代码 */
  pageCode?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 优先级 */
  priorityLevel?: number;

  /* 发布结束时间 */
  publishEndTime?: string;

  /* 发布开始时间 */
  publishStartTime?: string;

  /* 是否弹窗显示 */
  showAsPopup?: boolean;

  /* 开始时间 */
  startDate?: string;

  /* 通知标题 */
  title?: string;
};

export type NoticePageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: NoticePageResponseDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [NoticeDetailRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type NoticeDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type NoticeDetailResponse = BaseNoticeDto;

/**
 *  类型定义 [UpdateNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type UpdateNoticeRequest = UpdateNoticeDto;

export type UpdateNoticeResponse = IdDto;

/**
 *  类型定义 [BatchUpdateNoticeStatusRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type BatchUpdateNoticeStatusRequest = UpdateNoticeStatusDto;

export type BatchUpdateNoticeStatusResponse = CountDto;

/**
 *  类型定义 [BatchDeleteNoticeRequest]
 *  @来源 客户端通知模块
 *  @更新时间 2025-10-20 09:05:51
 */
export type BatchDeleteNoticeRequest = IdsDto;

export type BatchDeleteNoticeResponse = CountDto;

/**
 *  类型定义 [CreateNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type CreateNoticeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 通知内容详情 */
  content: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;

  /* 通知标题 */
  title: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [NoticePageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type NoticePageResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 通知所关联的客户端页面信息 */
  clientPage: ClientPageDto;
  /* 创建时间 */
  createdAt: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 通知ID */
  id: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否发布 */
  isPublished: boolean;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 阅读次数 */
  readCount?: number;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 通知标题 */
  title: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [ClientPageDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type ClientPageDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面名称 */
  pageName: string;

  /* 页面路径（URL路径） */
  pagePath: string;
};

/**
 *  类型定义 [BaseNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type BaseNoticeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 通知所关联的客户端页面信息 */
  clientPage: ClientPageDto;
  /* 通知内容详情 */
  content: string;
  /* 创建时间 */
  createdAt: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 通知ID */
  id: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 是否发布 */
  isPublished: boolean;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 阅读次数 */
  readCount?: number;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;
  /* 通知标题 */
  title: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [UpdateNoticeDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type UpdateNoticeDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 通知内容详情 */
  content: string;
  /* 启用的平台 */
  enablePlatform: number;
  /* 主键id */
  id: number;
  /* 是否置顶 */
  isPinned?: boolean;
  /* 通知类型 */
  noticeType: 0 | 1 | 2 | 3;
  /* 排序权重（数值越大越靠前） */
  order?: number;
  /* 关联页面代码 */
  pageCode?: string;
  /* 通知弹窗背景图片URL */
  popupBackgroundImage?: string;
  /* 优先级 */
  priorityLevel: 0 | 1 | 2 | 3;
  /* 发布结束时间 */
  publishEndTime?: string;
  /* 发布开始时间 */
  publishStartTime?: string;
  /* 是否弹窗显示 */
  showAsPopup?: boolean;

  /* 通知标题 */
  title: string;
};

/**
 *  类型定义 [UpdateNoticeStatusDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type UpdateNoticeStatusDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 通知ID列表 */
  ids: number[];

  /* 是否发布 */
  isPublished: boolean;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type CountDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据数量 */
  count: number;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-20 09:05:51
 */
export type IdsDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  ids: number[];
};
