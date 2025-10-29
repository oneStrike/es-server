/**
 *  类型定义 [RequestLogPageRequest]
 *  @来源 系统请求日志模块
 *  @更新时间 2025-10-29 10:28:15
 */
export type RequestLogPageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作类型 */
  actionType?: string;

  /* 接口类型（admin/client/system等） */
  apiType?: string;

  /* 结束时间 */
  endDate?: string;

  /* IP地址 */
  ip?: string;

  /* 操作是否成功 */
  isSuccess?: boolean;

  /* 请求方法 */
  method?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 请求路径 */
  path?: string;

  /* 开始时间 */
  startDate?: string;

  /* 用户ID */
  userId?: number;

  /* 用户名 */
  username?: string;
};

export type RequestLogPageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: RequestLogDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [RequestLogDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-29 10:28:15
 */
export type RequestLogDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 操作类型 */
  actionType?:
    | '创建数据'
    | '删除数据'
    | '数据导入'
    | '数据导出'
    | '文件上传'
    | '文件下载'
    | '更新数据'
    | '用户登出'
    | '用户登录';
  /* 接口类型（admin/client/system等） */
  apiType?: 'admin' | 'client' | 'public' | 'system';
  /* 自定义日志内容 */
  content: string;
  /* 创建时间 */
  createdAt: string;
  /* 设备信息解析结果（JSON） */
  device?: string;
  /* 主键ID */
  id: number;
  /* IP地址 */
  ip?: string;
  /* 操作是否成功 */
  isSuccess: boolean;
  /* 请求方法 */
  method: 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';
  /* 请求参数（JSON格式） */
  params?: string;
  /* 请求路径 */
  path: string;
  /* 更新时间 */
  updatedAt: string;
  /* 设备信息（User-Agent） */
  userAgent?: string;
  /* 用户ID */
  userId?: number;

  /* 用户名 */
  username?: string;
};
