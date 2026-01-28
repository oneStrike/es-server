// 启用的客户端平台 bitmask
export enum EnablePlatformEnum {
  /** H5 */
  H5 = 1,
  /** APP */
  APP = 2,
  /** 小程序 */
  MINI_PROGRAM = 3,
}

/**
 * 接口类型枚举
 */
export enum ApiTypeEnum {
  ADMIN = 'admin',
  APP = 'app',
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
  /** 插画 */
  ILLUSTRATION = 4,
  /** 小说 */
  NOVEL = 2,
  /** 写真 */
  PHOTO = 8,
}

// / 性别枚举
export enum GenderEnum {
  /** 女性 */
  FEMALE = 2,
  /** 男性 */
  MALE = 1,
  /** 其他 */
  OTHER = 3,
  /** 保密 */
  SECRET = 4,
  /** 未知 */
  UNKNOWN = 0,
}

/**
 * 作品查看权限
 */
export enum WorkViewPermissionEnum {
  /** 所有人 */
  ALL = 0,
  /** 登录用户 */
  LOGGED_IN = 1,
  /** 会员 */
  MEMBER = 2,
  /** 积分购买 */
  POINTS = 3,
}
