/**
 *  类型定义 [RequestLogPageRequest]
 *  @来源 请求日志
 *  @更新时间 2025-08-23 16:01:23
 */
export type RequestLogPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 接口类型（admin/client/system等） */
  apiType: string;

  /* 结束时间 */
  endDate?: string;

  /* 结束时间 */
  endTime?: string;

  /* 操作是否成功 */
  isSuccess: boolean;

  /* 请求方法 */
  method: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 请求路径 */
  path: string;

  /* 开始时间 */
  startDate?: string;

  /* 开始时间 */
  startTime?: string;

  /* 用户id */
  userId?: number;

  /* 用户名 */
  username?: string;
};

export type RequestLogPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: RequestLogPageDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [RequestLogDetailRequest]
 *  @来源 请求日志
 *  @更新时间 2025-08-23 16:01:23
 */
export type RequestLogDetailRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

export type RequestLogDetailResponse = RequestLogDto;

/**
 *  类型定义 [RequestLogPageDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type RequestLogPageDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 操作类型 */
  actionType?: string;
  /* 接口类型（admin/client/system等） */
  apiType: 'ADMIN' | 'CLIENT' | 'SYSTEM';
  /* 自定义日志内容 */
  content: string;
  /* 主键id */
  id: number;
  /* 用户ip */
  ip: string;
  /* 操作是否成功 */
  isSuccess: boolean;
  /* 请求方法 */
  method: string;
  /* 请求路径 */
  path: string;
  /* 响应时间（毫秒） */
  responseTimeMs: number;
  /* 状态码 */
  statusCode: number;
  /* 追踪ID */
  traceId?: string;
  /* 用户代理 */
  userAgent?: string;
  /* 用户id */
  userId?: number;

  /* 用户名 */
  username?: string;
};

/**
 *  类型定义 [RequestLogDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-23 16:01:23
 */
export type RequestLogDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 操作类型 */
  actionType?: string;
  /* 接口类型（admin/client/system等） */
  apiType: 'ADMIN' | 'CLIENT' | 'SYSTEM';
  /* 自定义日志内容 */
  content: string;
  /* 创建时间 */
  createdAt: string;
  /* 设备信息 */
  device?: string;
  /* 主键id */
  id: number;
  /* 用户ip */
  ip: string;
  /* 操作是否成功 */
  isSuccess: boolean;
  /* 请求方法 */
  method: string;
  /* 请求参数（JSON格式） */
  params?: string;
  /* 请求路径 */
  path: string;
  /* 响应时间（毫秒） */
  responseTimeMs: number;
  /* 状态码 */
  statusCode: number;
  /* 追踪ID */
  traceId?: string;
  /* 用户代理 */
  userAgent?: string;
  /* 用户id */
  userId?: number;

  /* 用户名 */
  username?: string;
};
