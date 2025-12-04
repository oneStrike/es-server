// 启用的客户端平台 bitmask
export enum EnablePlatformEnum {
  /** H5 */
  H5 = 1,
  /** APP */
  APP = 2,
  /** 小程序 */
  MINI_PROGRAM = 4,
}

/**
 * 接口类型枚举
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
