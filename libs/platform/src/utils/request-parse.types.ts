import type { ApiTypeEnum, HttpMethodEnum } from '@libs/platform/constant';
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.types'
import type { StructuredObject, StructuredValue } from './jsonParse'

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
  body?: StructuredValue
  /** 查询参数 */
  query?: StructuredObject
  /** 路径参数 */
  params?: StructuredObject
}

/**
 * 统一请求上下文接口
 * 汇总请求链路中最常复用的元信息，供 controller、service、filter 共享
 */
/** 稳定领域类型 `RequestContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface RequestContext extends GeoSnapshot {
  /** 客户端 IP */
  ip?: string
  /** HTTP 方法 */
  method: HttpMethodEnum
  /** 请求路径 */
  path: string
  /** 请求参数 */
  params?: RequestParams
  /** User-Agent */
  userAgent?: string
  /** 设备信息（结构化） */
  deviceInfo?: DeviceInfo
  /** 接口类型 */
  apiType?: ApiTypeEnum
}

/**
 * 客户端请求上下文接口
 * auth、浏览记录等场景只关心客户端来源信息时，统一透传这一最小子集
 */
/** 稳定领域类型 `ClientRequestContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ClientRequestContext extends GeoSnapshot {
  /** 客户端 IP */
  ip?: string
  /** User-Agent */
  userAgent?: string
  /** 设备信息（结构化） */
  deviceInfo?: DeviceInfo
}

/**
 * 请求日志字段提取结果接口
 */
export interface ParsedRequestData extends GeoSnapshot {
  /** 客户端 IP */
  ip?: string
  /** HTTP 方法 */
  method: HttpMethodEnum
  /** 请求路径 */
  path: string
  /** 请求参数 */
  params?: RequestParams
  /** User-Agent */
  userAgent?: string
  /** 设备信息（JSON 对象） */
  device?: DeviceInfo
  /** 接口类型 */
  apiType?: ApiTypeEnum
}
