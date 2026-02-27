/**
 * 基础常量定义
 * 覆盖平台、接口类型、HTTP 方法、内容类型等基础枚举
 */
/// 启用平台枚举
export enum EnablePlatformEnum {
  /** H5 */
  H5 = 1,
  /** App */
  APP = 2,
  /** 小程序 */
  MINI_PROGRAM = 3,
}

/// 接口所属类型枚举
export enum ApiTypeEnum {
  /** 管理端 */
  ADMIN = 'admin',
  /** 应用端 */
  APP = 'app',
  /** 系统端 */
  SYSTEM = 'system',
  /** 公共端 */
  PUBLIC = 'public',
}

/// HTTP 方法枚举
export enum HttpMethodEnum {
  /** GET */
  GET = 'GET',
  /** POST */
  POST = 'POST',
  /** PUT */
  PUT = 'PUT',
  /** DELETE */
  DELETE = 'DELETE',
  /** PATCH */
  PATCH = 'PATCH',
  /** HEAD */
  HEAD = 'HEAD',
  /** OPTIONS */
  OPTIONS = 'OPTIONS',
}

/// 内容类型枚举
export enum ContentTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 插画 */
  ILLUSTRATION = 4,
  /** 小说 */
  NOVEL = 2,
  /** 图片 */
  PHOTO = 8,
}

/// 性别枚举
export enum GenderEnum {
  /** 女 */
  FEMALE = 2,
  /** 男 */
  MALE = 1,
  /** 其他 */
  OTHER = 3,
  /** 保密 */
  SECRET = 4,
  /** 未知 */
  UNKNOWN = 0,
}

/// 作品可见权限枚举
export enum WorkViewPermissionEnum {
  INHERIT = -1,
  /** 所有人可见 */
  ALL = 0,
  /** 登录用户可见 */
  LOGGED_IN = 1,
  /** 会员可见 */
  MEMBER = 2,
  /** 需购买可见 */
  PURCHASE = 3,
}
