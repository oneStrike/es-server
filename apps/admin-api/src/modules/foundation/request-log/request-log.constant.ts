/**
 * 请求日志模块常量定义
 */

/**
 * API类型枚举
 */
export enum ApiTypeEnum {
  ADMIN = 'admin',
  CLIENT = 'client',
  SYSTEM = 'system',
  PUBLIC = 'public',
}

/**
 * HTTP方法枚举
 */
export enum HttpMethodEnum {
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
export enum ActionTypeEnum {
  LOGIN = '用户登录',
  LOGOUT = '用户登出',
  CREATE = '创建数据',
  UPDATE = '更新数据',
  DELETE = '删除数据',
  UPLOAD = '文件上传',
  DOWNLOAD = '文件下载',
  EXPORT = '数据导出',
  IMPORT = '数据导入',
}
