import type { UploadSystemConfig } from '@libs/platform/modules/upload/upload.type'
import type {
  ChatMediaFileCategory,
  ChatMediaOriginPolicy,
  ChatMediaOriginPolicyOptions,
} from './chat-media-origin-policy.type'
import { posix } from 'node:path'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'

const TRAILING_SLASH_REGEX = /\/+$/
const LEADING_SLASH_REGEX = /^\/+/
const HTTP_PREFIX_REGEX = /^https?:\/\//i
const RESERVED_PATH_SEGMENTS = new Set(['.', '..'])

/** 基于上传配置构造聊天媒体来源策略，要求文件路径属于 scene=chat。 */
export function buildChatMediaOriginPolicy(
  options: ChatMediaOriginPolicyOptions,
): ChatMediaOriginPolicy {
  return {
    accepts: (filePath, fileCategory) =>
      acceptsLocalUploadPath(
        filePath,
        fileCategory,
        options.uploadConfig.localUrlPrefix,
        options.uploadConfig.allowExtensions[fileCategory],
      ) ||
      acceptsQiniuUploadPath(
        filePath,
        fileCategory,
        options.systemUploadConfig,
        options.uploadConfig.allowExtensions[fileCategory],
      ),
  }
}

// 校验本地上传返回的相对路径或绝对 URL。
function acceptsLocalUploadPath(
  filePath: string,
  fileCategory: ChatMediaFileCategory,
  localUrlPrefix: string,
  allowExtensions: string[],
) {
  const relativePath = extractPathAfterPrefix(filePath, localUrlPrefix)
  return acceptsObjectPath(relativePath, fileCategory, allowExtensions)
}

// 校验七牛上传返回的 provider URL；Superbed 外部 URL 不进入聊天媒体白名单。
function acceptsQiniuUploadPath(
  filePath: string,
  fileCategory: ChatMediaFileCategory,
  systemUploadConfig: UploadSystemConfig | undefined,
  allowExtensions: string[],
) {
  if (
    !systemUploadConfig ||
    systemUploadConfig.provider !== UploadProviderEnum.QINIU ||
    !systemUploadConfig.qiniu.domain
  ) {
    return false
  }

  const candidateUrl = parseUrl(filePath)
  const providerBaseUrl = parseUrl(
    normalizeProviderDomain(
      systemUploadConfig.qiniu.domain,
      systemUploadConfig.qiniu.useHttps,
    ),
  )
  if (!candidateUrl || !providerBaseUrl) {
    return false
  }

  if (candidateUrl.origin !== providerBaseUrl.origin) {
    return false
  }

  const prefixPath = joinUrlPath(
    providerBaseUrl.pathname,
    systemUploadConfig.qiniu.pathPrefix,
  )
  const relativePath = stripPrefixPath(candidateUrl.pathname, prefixPath)
  return acceptsObjectPath(relativePath, fileCategory, allowExtensions)
}

// 判断去除 provider/local 前缀后的 objectKey 是否为 chat/<category>/...。
function acceptsObjectPath(
  objectPath: string | null,
  fileCategory: ChatMediaFileCategory,
  allowExtensions: string[],
) {
  if (!objectPath) {
    return false
  }

  const segments = objectPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (
    segments.length < 4 ||
    segments.some((segment) => isReservedPathSegment(segment)) ||
    segments[0] !== 'chat' ||
    segments[1] !== fileCategory
  ) {
    return false
  }

  const extension = posix
    .extname(segments.at(-1) ?? '')
    .slice(1)
    .toLowerCase()
  return Boolean(extension && allowExtensions.includes(extension))
}

// 判断路径片段是否存在目录穿越语义，包含常规和 URL 编码形态。
function isReservedPathSegment(segment: string) {
  if (RESERVED_PATH_SEGMENTS.has(segment)) {
    return true
  }

  try {
    const decoded = decodeURIComponent(segment)
    return RESERVED_PATH_SEGMENTS.has(decoded) || decoded.includes('/')
  } catch {
    return true
  }
}

// 从本地 URL 前缀中切出 objectKey 部分，保留相对路径和绝对 URL 两种上传返回形态。
function extractPathAfterPrefix(filePath: string, prefix: string) {
  if (!filePath || !prefix) {
    return null
  }

  const absoluteFileUrl = parseUrl(filePath)
  const absolutePrefixUrl = parseUrl(prefix)
  if (absolutePrefixUrl) {
    if (
      !absoluteFileUrl ||
      absoluteFileUrl.origin !== absolutePrefixUrl.origin
    ) {
      return null
    }
    return stripPrefixPath(absoluteFileUrl.pathname, absolutePrefixUrl.pathname)
  }

  const targetPath = absoluteFileUrl ? null : stripQueryAndHash(filePath)
  return stripPrefixPath(targetPath, prefix)
}

// 按 path 前缀切分，避免 `/files2` 被误判为 `/files`。
function stripPrefixPath(pathname: string | null, prefix: string) {
  if (!pathname) {
    return null
  }
  const normalizedPath = normalizePathname(pathname)
  const normalizedPrefix = normalizePathname(prefix)
  if (normalizedPrefix === '/') {
    return normalizedPath.replace(LEADING_SLASH_REGEX, '')
  }
  if (normalizedPath === normalizedPrefix) {
    return ''
  }
  if (!normalizedPath.startsWith(`${normalizedPrefix}/`)) {
    return null
  }
  return normalizedPath
    .slice(normalizedPrefix.length + 1)
    .replace(LEADING_SLASH_REGEX, '')
}

// 拼接 URL path 片段并保持空前缀可用。
function joinUrlPath(...parts: string[]) {
  const normalized = parts
    .flatMap((part) => part.split('/'))
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')
  return normalized ? `/${normalized}` : '/'
}

// 规范化 provider domain，兼容配置中省略协议的情况。
function normalizeProviderDomain(domain: string, useHttps: boolean) {
  const normalizedDomain = domain.trim().replace(TRAILING_SLASH_REGEX, '')
  if (HTTP_PREFIX_REGEX.test(normalizedDomain)) {
    return normalizedDomain
  }
  return `${useHttps ? 'https' : 'http'}://${normalizedDomain}`
}

// 规范化 path，统一去除 query、hash 和末尾斜杠。
function normalizePathname(pathname: string) {
  const stripped = stripQueryAndHash(pathname).replace(TRAILING_SLASH_REGEX, '')
  return stripped.startsWith('/') ? stripped || '/' : `/${stripped}`
}

// 去除 URL 查询串与 hash，避免文件名判断被尾部参数干扰。
function stripQueryAndHash(value: string) {
  return value.split(/[?#]/, 1)[0] ?? ''
}

// 尝试解析绝对 URL，失败时返回 null。
function parseUrl(value: string) {
  if (!HTTP_PREFIX_REGEX.test(value.trim())) {
    return null
  }
  try {
    return new URL(value)
  } catch {
    return null
  }
}
