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
