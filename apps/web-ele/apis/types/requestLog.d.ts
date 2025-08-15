/**
 *  类型定义 [RequestLogPageRequest]
 *  @来源 管理端请求日志模块
 *  @更新时间 2025-08-15 22:51:38
 */
export type RequestLogPageRequest = {
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

  /* 用户名模糊查询 */
  username?: string

  /* 用户ID精确查询 */
  userId?: number

  /* 响应状态码 */
  responseCode?: number

  /* 请求方法 */
  httpMethod?: string

  /* 请求路径模糊查询 */
  requestPath?: string

  /** 任意合法数值 */
  [property: string]: any
}

export type RequestLogPageResponse = {
  /* 当前页码 */
  pageIndex?: number

  /* 每页条数 */
  pageSize?: number

  /* 总条数 */
  total?: number

  /* 列表数据 */
  list?: RequestLogDto[]

  /** 任意合法数值 */
  [property: string]: any
}

/**
 *  类型定义 [RequestLogDetailRequest]
 *  @来源 管理端请求日志模块
 *  @更新时间 2025-08-15 22:51:38
 */
export type RequestLogDetailRequest = {
  
  id: number

  /** 任意合法数值 */
  [property: string]: any
}

export type RequestLogDetailResponse = RequestLogDto

/**
 *  类型定义 [RequestLogDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-15 22:51:38
 */
export type RequestLogDto = {
  /* 主键ID */
  id: number
  /* 用户名 */
  username?: string
  /* 用户主键ID */
  userId?: number
  /* 调用IP地址 */
  ipAddress: string
  /* IP映射地址 */
  ipLocation: string
  /* 响应状态码 */
  responseCode: number
  /* 响应描述 */
  responseMessage: string
  /* 请求方法 */
  httpMethod: string
  /* 请求路径 */
  requestPath: string
  /* 接口描述信息 */
  operationDescription: string
  /* 浏览器信息标识 */
  userAgent: string
  /* 请求参数 */
  requestParams?: string
  /* 创建时间 */
  createdAt: string
  /* 更新时间 */
  updatedAt: string

  /** 任意合法数值 */
  [property: string]: any
}