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

/**
 * 内容类型枚举 bitmask
 */
export enum ContentTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 插画 */
  ILLUSTRATION = 4,
  /** 写真 */
  PHOTO = 8,
}

/// 性别枚举
export enum GenderEnum {
  /** 未知 */
  UNKNOWN = 0,
  /** 男性 */
  MALE = 1,
  /** 女性 */
  FEMALE = 2,
  /** 其他 */
  OTHER = 3,
}
