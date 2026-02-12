import type { ApiTypeEnum, HttpMethodEnum } from '@libs/base/constant'

/**
 * 设备信息接口
 */
export interface DeviceInfo {
  /** 浏览器名称 */
  browser?: string
  /** 操作系统名称 */
  os?: string
  /** 设备名称 */
  device?: string
  /** 浏览器版本 */
  version?: string
}

/**
 * 请求参数提取结果接口
 */
export interface RequestParams {
  /** 请求体 */
  body?: any
  /** 查询参数 */
  query?: Record<string, any>
  /** 路径参数 */
  params?: Record<string, any>
}

/**
 * 请求日志字段提取结果接口
 */
export interface ParsedRequestData {
  /** 客户端 IP */
  ip?: string
  /** HTTP 方法 */
  method: HttpMethodEnum
  /** 请求路径 */
  path: string
  /** 序列化后的参数 */
  params?: string
  /** User-Agent */
  userAgent?: string
  /** 设备信息（序列化后） */
  device?: string
  /** 接口类型 */
  apiType?: ApiTypeEnum
}
