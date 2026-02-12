import type { FastifyRequest } from 'fastify'
import type {
  DeviceInfo,
  ParsedRequestData,
  RequestParams,
} from './request-parse.types'
import { ApiTypeEnum, HttpMethodEnum } from '@libs/base/constant'

/**
 * 从 FastifyRequest 中提取 IP 地址
 * 优先级：x-forwarded-for > x-real-ip > req.ip > socket.remoteAddress
 *
 * @param req - Fastify 请求对象
 * @returns IP 地址字符串，如果无法获取则返回 undefined
 */
export function extractIpAddress(req: FastifyRequest): string | undefined {
  try {
    // 处理代理转发的 IP
    const forwardedFor = req.headers['x-forwarded-for']
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
      const firstIp = ips.split(',')[0]?.trim()
      if (firstIp) {
        return firstIp
      }
    }

    // 处理真实 IP
    const realIp = req.headers['x-real-ip']
    if (realIp && typeof realIp === 'string') {
      return realIp.trim()
    }

    // Fastify 内置 IP
    if (req.ip) {
      return req.ip
    }

    // Socket 远程地址
    return req.socket?.remoteAddress
  } catch (error) {
    console.warn('提取IP地址失败:', error)
    return undefined
  }
}

/**
 * 从 FastifyRequest 中提取 HTTP 方法
 *
 * @param req - Fastify 请求对象
 * @returns HTTP 方法枚举值
 */
export function extractHttpMethod(req: FastifyRequest): HttpMethodEnum {
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
export function extractRequestPath(req: FastifyRequest): string {
  try {
    // 使用 url 获取请求路径
    return req.url || '/'
  } catch (error) {
    console.warn('提取请求路径失败:', error)
    return '/'
  }
}

/**
 * 从 FastifyRequest 中提取请求参数
 * 合并 body、query、params 参数，时间复杂度 O(n)
 *
 * @param req - Fastify 请求对象
 * @returns JSON 字符串格式的参数，如果无参数则返回 undefined
 */
export function extractRequestParams(req: FastifyRequest): string | undefined {
  try {
    const params: RequestParams = {}
    let hasParams = false

    // 提取 body 参数
    if (req.body && typeof req.body === 'object') {
      params.body = req.body
      hasParams = true
    }

    // 提取 query 参数
    if (
      req.query &&
      typeof req.query === 'object' &&
      Object.keys(req.query).length > 0
    ) {
      params.query = req.query
      hasParams = true
    }

    // 提取 params 参数
    if (
      req.params &&
      typeof req.params === 'object' &&
      Object.keys(req.params).length > 0
    ) {
      params.params = req.params
      hasParams = true
    }
    // 密码字段
    delete params?.body?.password
    // 上传文件字段，无法被json转换
    delete params?.body?.scene
    delete params?.body?.file
    return hasParams ? JSON.stringify(params) : undefined
  } catch (error) {
    console.warn('提取请求参数失败:', error)
    return undefined
  }
}

/**
 * 从 FastifyRequest 中提取 User-Agent
 *
 * @param req - Fastify 请求对象
 * @returns User-Agent 字符串，如果不存在则返回 undefined
 */
export function extractUserAgent(req: FastifyRequest): string | undefined {
  try {
    const userAgent = req.headers['user-agent']
    return typeof userAgent === 'string' ? userAgent.trim() : undefined
  } catch (error) {
    console.warn('提取用户代理失败:', error)
    return undefined
  }
}

/**
 * 解析 User-Agent 字符串获取设备信息
 * 使用高效的正则匹配，时间复杂度 O(1)
 *
 * @param userAgent - User-Agent 字符串
 * @returns 设备信息对象的 JSON 字符串，如果解析失败则返回 undefined
 */
export function parseDeviceInfo(userAgent?: string): string | undefined {
  if (!userAgent) {
    return undefined
  }

  try {
    const device: DeviceInfo = {}

    // 浏览器检测（按优先级排序）
    let match = userAgent.match(/Chrome\/(\d+)/)
    if (match) {
      device.browser = 'Chrome'
      device.version = match[1]
    } else {
      match = userAgent.match(/Firefox\/(\d+)/)
      if (match) {
        device.browser = 'Firefox'
        device.version = match[1]
      } else if (/Safari\/\d+/.test(userAgent) && !/Chrome/.test(userAgent)) {
        match = userAgent.match(/Safari\/(\d+)/)
        device.browser = 'Safari'
        if (match) {
          device.version = match[1]
        }
      } else {
        match = userAgent.match(/Edge\/(\d+)/)
        if (match) {
          device.browser = 'Edge'
          device.version = match[1]
        } else {
          match = userAgent.match(/Opera\/(\d+)/)
          if (match) {
            device.browser = 'Opera'
            device.version = match[1]
          }
        }
      }
    }

    // 操作系统检测
    if (/Windows NT \d+\.\d+/.test(userAgent)) {
      device.os = 'Windows'
    } else if (/Mac OS X \d+[._]\d+/.test(userAgent)) {
      device.os = 'macOS'
    } else if (/Linux/.test(userAgent)) {
      device.os = 'Linux'
    } else if (/Android \d+\.\d+/.test(userAgent)) {
      device.os = 'Android'
    } else if (/iPhone OS \d+[._]\d+/.test(userAgent)) {
      device.os = 'iOS'
    }

    // 设备类型检测
    if (/Mobile/.test(userAgent)) {
      device.device = 'Mobile'
    } else if (/Tablet/.test(userAgent)) {
      device.device = 'Tablet'
    } else {
      device.device = 'Desktop'
    }

    return Object.keys(device).length > 0 ? JSON.stringify(device) : undefined
  } catch (error) {
    console.warn('解析设备信息失败:', error)
    return undefined
  }
}

/**
 * 从请求路径中提取 API 类型
 * 根据路径前缀判断 API 类型，时间复杂度 O(1)
 *
 * @param path - 请求路径
 * @returns API 类型枚举值，如果无法判断则返回 undefined
 */
export function extractApiType(path: string): ApiTypeEnum | undefined {
  if (!path) {
    return undefined
  }

  try {
    const normalizedPath = path.toLowerCase()

    // 按优先级匹配路径前缀
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
  } catch (error) {
    console.warn('提取API类型失败:', error)
    return undefined
  }
}

/**
 * 从 FastifyRequest 中提取所有可解析的请求日志字段
 * 一次性提取所有字段，避免重复遍历，时间复杂度 O(n)
 *
 * @param req - Fastify 请求对象
 * @returns 解析后的请求数据对象
 * @throws 当 req 参数为 null 或 undefined 时抛出错误
 */
export function parseRequestLogFields(req: FastifyRequest): ParsedRequestData {
  if (!req) {
    throw new Error('请求对象是必需的')
  }

  try {
    const path = extractRequestPath(req)
    const userAgent = extractUserAgent(req)

    return {
      ip: extractIpAddress(req),
      method: extractHttpMethod(req),
      path,
      params: extractRequestParams(req),
      userAgent,
      device: parseDeviceInfo(userAgent),
      apiType: extractApiType(path),
    }
  } catch (error) {
    console.error('解析请求日志字段失败:', error)
    throw new Error(
      `Request parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
