/**
 * 请求日志模块常量定义
 */

/**
 * API类型枚举
 */
export enum ApiType {
  ADMIN = 'admin',
  CLIENT = 'client',
  SYSTEM = 'system',
  PUBLIC = 'public',
}

/**
 * HTTP方法枚举
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

/**
 * 常用操作类型
 */
export enum ActionType {
  LOGIN = '用户登录',
  LOGOUT = '用户登出',
  REGISTER = '用户注册',
  CREATE = '创建数据',
  UPDATE = '更新数据',
  DELETE = '删除数据',
  QUERY = '查询数据',
  UPLOAD = '文件上传',
  DOWNLOAD = '文件下载',
  EXPORT = '数据导出',
  IMPORT = '数据导入',
}

/**
 * 日志保留策略
 */
export const LOG_RETENTION = {
  /** 默认保留天数 */
  DEFAULT_DAYS: 30,
  /** 成功日志保留天数 */
  SUCCESS_DAYS: 7,
  /** 错误日志保留天数 */
  ERROR_DAYS: 90,
  /** 系统日志保留天数 */
  SYSTEM_DAYS: 180,
} as const

/**
 * 缓存键前缀
 */
export const CacheKey = {
  /** 请求日志统计缓存 */
  STATS: 'request_log:stats',
  /** 热门API缓存 */
  POPULAR_APIS: 'request_log:popular_apis',
  /** 错误统计缓存 */
  ERROR_STATS: 'request_log:error_stats',
} as const

/**
 * 分页默认配置
 */
export const PAGINATION = {
  /** 默认页大小 */
  DEFAULT_PAGE_SIZE: 15,
  /** 最大页大小 */
  MAX_PAGE_SIZE: 500,
} as const
