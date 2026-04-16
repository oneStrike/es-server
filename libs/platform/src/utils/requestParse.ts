import type { FastifyRequest } from 'fastify'
import type { StructuredObject, StructuredValue } from './jsonParse'
import type {
  ClientRequestContext,
  DeviceInfo,
  ParsedRequestData,
  RequestContext,
  RequestParams,
} from './request-parse.types'
import {
  ApiTypeEnum,
  HttpMethodEnum,
} from '@libs/platform/constant/base.constant'
import { maskString } from './mask'

// 浏览器检测正则表达式（模块作用域，避免重复编译）
const CHROME_REGEX = /Chrome\/(\d+)/
const FIREFOX_REGEX = /Firefox\/(\d+)/
const SAFARI_REGEX = /Safari\/(\d+)/
const EDGE_REGEX = /Edge\/(\d+)/
const OPERA_REGEX = /Opera\/(\d+)/
const SAFARI_CHECK_REGEX = /Safari\/\d+/
const CHROME_CHECK_REGEX = /Chrome/

// 操作系统检测正则表达式
const WINDOWS_REGEX = /Windows NT \d+\.\d+/
const MACOS_REGEX = /Mac OS X \d+[._]\d+/
const LINUX_REGEX = /Linux/
const ANDROID_REGEX = /Android \d+\.\d+/
const IOS_REGEX = /iPhone OS \d+[._]\d+/

// 设备类型检测正则表达式
const MOBILE_REGEX = /Mobile/
const TABLET_REGEX = /Tablet/

const OMITTED_REQUEST_FIELDS = new Set(['scene', 'file'])
const SENSITIVE_REQUEST_FIELDS = new Set([
  'password',
  'oldpassword',
  'newpassword',
  'confirmpassword',
  'accesstoken',
  'refreshtoken',
  'token',
  'authorization',
  'accesskeyid',
  'accesskeysecret',
  'secret',
])

function isPlainObject<T>(value: T): value is Extract<T, StructuredObject> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function shouldOmitRequestField(key: string) {
  return OMITTED_REQUEST_FIELDS.has(key.toLowerCase())
}

function isSensitiveRequestField(key: string) {
  const normalized = key.toLowerCase()
  return (
    SENSITIVE_REQUEST_FIELDS.has(normalized) ||
    normalized.endsWith('password') ||
    normalized.endsWith('token') ||
    normalized.endsWith('secret')
  )
}

function maskSensitiveValue<T>(value: T): StructuredValue | '[REDACTED]' {
  if (typeof value === 'string') {
    return maskString(value, 2, 2)
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveValue(item))
  }
  if (isPlainObject(value)) {
    return '[REDACTED]'
  }
  return value ?? '[REDACTED]'
}

function sanitizeRequestValue<T>(value: T): StructuredValue {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRequestValue(item))
  }

  if (!isPlainObject(value)) {
    return value as StructuredValue
  }

  const sanitized: StructuredObject = {}

  for (const [key, fieldValue] of Object.entries(value)) {
    if (shouldOmitRequestField(key)) {
      continue
    }

    sanitized[key] = isSensitiveRequestField(key)
      ? maskSensitiveValue(fieldValue)
      : sanitizeRequestValue(fieldValue)
  }

  return sanitized
}

/**
 * 从 FastifyRequest 中提取 IP 地址
 * 优先级：x-forwarded-for > x-real-ip > req.ip > socket.remoteAddress
 *
 * @param req - Fastify 请求对象
 * @returns IP 地址字符串，如果无法获取则返回 undefined
 */
export function extractIpAddress(req: FastifyRequest) {
  const forwardedFor = req.headers['x-forwarded-for']
  const forwardedForValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor
  if (typeof forwardedForValue === 'string') {
    const firstIp = forwardedForValue.split(',')[0]?.trim()
    if (firstIp) {
      return firstIp
    }
  }

  const realIp = req.headers['x-real-ip']
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp
  if (typeof realIpValue === 'string') {
    const normalizedRealIp = realIpValue.trim()
    if (normalizedRealIp) {
      return normalizedRealIp
    }
  }

  if (req.ip) {
    return req.ip
  }

  return req.socket?.remoteAddress
}

/**
 * 从 FastifyRequest 中提取 HTTP 方法
 *
 * @param req - Fastify 请求对象
 * @returns HTTP 方法枚举值
 */
export function extractHttpMethod(req: FastifyRequest) {
  const method = req.method?.toUpperCase() as HttpMethodEnum
  return Object.values(HttpMethodEnum).includes(method)
    ? method
    : HttpMethodEnum.GET
}

/**
 * 从 FastifyRequest 中提取请求路径
 *
 * @param req - Fastify 请求对象
 * @returns 请求路径字符串
 */
export function extractRequestPath(req: FastifyRequest) {
  return req.url || '/'
}

/**
 * 从 FastifyRequest 中提取请求参数
 * 合并 body、query、params 参数，时间复杂度 O(n)
 *
 * @param req - Fastify 请求对象
 * @returns 请求参数对象，如果无参数则返回 undefined
 */
export function extractRequestParams(req: FastifyRequest) {
  const params: RequestParams = {}
  let hasParams = false

  if (req.body && typeof req.body === 'object') {
    params.body = sanitizeRequestValue(req.body)
    hasParams = true
  }

  if (
    req.query &&
    typeof req.query === 'object' &&
    Object.keys(req.query).length > 0
  ) {
    params.query = sanitizeRequestValue(req.query) as StructuredObject
    hasParams = true
  }

  if (
    req.params &&
    typeof req.params === 'object' &&
    Object.keys(req.params).length > 0
  ) {
    params.params = sanitizeRequestValue(req.params) as StructuredObject
    hasParams = true
  }

  return hasParams ? params : undefined
}

/**
 * 从 FastifyRequest 中提取 User-Agent
 *
 * @param req - Fastify 请求对象
 * @returns User-Agent 字符串，如果不存在则返回 undefined
 */
export function extractUserAgent(req: FastifyRequest) {
  const userAgent = req.headers['user-agent']
  const userAgentValue = Array.isArray(userAgent) ? userAgent[0] : userAgent
  return typeof userAgentValue === 'string' ? userAgentValue.trim() : undefined
}

/**
 * 解析 User-Agent 字符串获取设备信息
 * 使用高效的正则匹配，时间复杂度 O(1)
 *
 * @param userAgent - User-Agent 字符串
 * @returns 设备信息对象，如果解析失败则返回 undefined
 */
export function parseDeviceInfo(userAgent?: string) {
  if (!userAgent) {
    return undefined
  }

  const deviceInfo: DeviceInfo = {}

  let match = userAgent.match(CHROME_REGEX)
  if (match) {
    deviceInfo.browser = 'Chrome'
    deviceInfo.version = match[1]
  } else {
    match = userAgent.match(FIREFOX_REGEX)
    if (match) {
      deviceInfo.browser = 'Firefox'
      deviceInfo.version = match[1]
    } else if (
      SAFARI_CHECK_REGEX.test(userAgent) &&
      !CHROME_CHECK_REGEX.test(userAgent)
    ) {
      match = userAgent.match(SAFARI_REGEX)
      deviceInfo.browser = 'Safari'
      if (match) {
        deviceInfo.version = match[1]
      }
    } else {
      match = userAgent.match(EDGE_REGEX)
      if (match) {
        deviceInfo.browser = 'Edge'
        deviceInfo.version = match[1]
      } else {
        match = userAgent.match(OPERA_REGEX)
        if (match) {
          deviceInfo.browser = 'Opera'
          deviceInfo.version = match[1]
        }
      }
    }
  }

  if (WINDOWS_REGEX.test(userAgent)) {
    deviceInfo.os = 'Windows'
  } else if (MACOS_REGEX.test(userAgent)) {
    deviceInfo.os = 'macOS'
  } else if (LINUX_REGEX.test(userAgent)) {
    deviceInfo.os = 'Linux'
  } else if (ANDROID_REGEX.test(userAgent)) {
    deviceInfo.os = 'Android'
  } else if (IOS_REGEX.test(userAgent)) {
    deviceInfo.os = 'iOS'
  }

  if (MOBILE_REGEX.test(userAgent)) {
    deviceInfo.device = 'Mobile'
  } else if (TABLET_REGEX.test(userAgent)) {
    deviceInfo.device = 'Tablet'
  } else {
    deviceInfo.device = 'Desktop'
  }

  return Object.keys(deviceInfo).length > 0 ? deviceInfo : undefined
}

/**
 * 将结构化设备信息序列化为字符串
 * 用于兼容仍使用字符串字段存储设备信息的历史业务表
 *
 * @param deviceInfo - 结构化设备信息
 * @returns 设备信息字符串
 */
export function serializeDeviceInfo(deviceInfo?: DeviceInfo) {
  return deviceInfo ? JSON.stringify(deviceInfo) : undefined
}

/**
 * 从请求路径中提取 API 类型
 * 根据路径前缀判断 API 类型，时间复杂度 O(1)
 *
 * @param path - 请求路径
 * @returns API 类型枚举值，如果无法判断则返回 undefined
 */
export function extractApiType(path: string) {
  if (!path) {
    return undefined
  }

  const normalizedPath = path.toLowerCase()

  if (
    normalizedPath.startsWith('/api/admin/') ||
    normalizedPath.includes('/admin/')
  ) {
    return ApiTypeEnum.ADMIN
  }
  if (
    normalizedPath.startsWith('/api/app/') ||
    normalizedPath.includes('/app/')
  ) {
    return ApiTypeEnum.APP
  }
  if (
    normalizedPath.startsWith('/api/system/') ||
    normalizedPath.includes('/system/')
  ) {
    return ApiTypeEnum.SYSTEM
  }
  if (
    normalizedPath.startsWith('/api/public/') ||
    normalizedPath.includes('/public/')
  ) {
    return ApiTypeEnum.PUBLIC
  }

  return undefined
}

/**
 * 从 FastifyRequest 中提取统一请求上下文
 * 供 controller、service、filter 共享请求元信息，避免多处重复拼装
 *
 * @param req - Fastify 请求对象
 * @returns 统一请求上下文
 * @throws 当 req 参数为 null 或 undefined 时抛出错误
 */
export function extractRequestContext(req: FastifyRequest): RequestContext {
  if (!req) {
    throw new Error('请求对象是必需的')
  }

  const path = extractRequestPath(req)
  const userAgent = extractUserAgent(req)

  return {
    ip: extractIpAddress(req),
    method: extractHttpMethod(req),
    path,
    params: extractRequestParams(req),
    userAgent,
    deviceInfo: parseDeviceInfo(userAgent),
    apiType: extractApiType(path),
  }
}

/**
 * 从 FastifyRequest 中提取客户端请求上下文
 * 只保留业务链路真正需要的客户端来源信息，避免下游继续依赖完整请求对象
 *
 * @param req - Fastify 请求对象
 * @returns 客户端请求上下文
 */
export function extractClientRequestContext(
  req: FastifyRequest,
): ClientRequestContext {
  const requestContext = extractRequestContext(req)

  return {
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
    deviceInfo: requestContext.deviceInfo,
  }
}

function isFastifyRequest(
  value: FastifyRequest | RequestContext,
): value is FastifyRequest {
  return 'headers' in value && 'url' in value
}

/**
 * 构建请求日志字段
 * 统一将请求上下文映射为审计日志和异常日志所需的持久化字段
 *
 * @param input - FastifyRequest 或已解析的请求上下文
 * @returns 请求日志字段
 */
export function buildRequestLogFields(
  input: FastifyRequest | RequestContext,
): ParsedRequestData {
  const requestContext = isFastifyRequest(input)
    ? extractRequestContext(input)
    : input

  return {
    ip: requestContext.ip,
    method: requestContext.method,
    path: requestContext.path,
    params: requestContext.params,
    userAgent: requestContext.userAgent,
    device: requestContext.deviceInfo,
    apiType: requestContext.apiType,
    geoCountry: requestContext.geoCountry,
    geoProvince: requestContext.geoProvince,
    geoCity: requestContext.geoCity,
    geoIsp: requestContext.geoIsp,
    geoSource: requestContext.geoSource,
  }
}
