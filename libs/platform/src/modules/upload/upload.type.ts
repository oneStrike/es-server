import type { DynamicModule, Type } from '@nestjs/common'

/**
 * 上传模块配置提供器注入 token。
 */
export const UPLOAD_CONFIG_PROVIDER = 'UPLOAD_CONFIG_PROVIDER'

/**
 * 上传 provider 类型。
 */
export enum UploadProviderEnum {
  /** 本地文件系统。 */
  LOCAL = 'local',
  /** 七牛云对象存储。 */
  QINIU = 'qiniu',
  /** Superbed 图床。 */
  SUPERBED = 'superbed',
}

/**
 * 七牛上传系统配置。
 * 约束鉴权、空间、域名和对象前缀等稳定参数。
 */
export interface UploadSystemQiniuConfig {
  accessKey: string
  secretKey: string
  bucket: string
  domain: string
  region: string
  pathPrefix: string
  useHttps: boolean
  tokenExpires: number
}

/**
 * Superbed 上传系统配置。
 * 约束 token、分类以及可选的图像处理开关。
 */
export interface UploadSystemSuperbedConfig {
  token: string
  categories: string
  watermark?: boolean
  compress?: boolean
  webp?: boolean
}

/**
 * 上传系统总配置。
 * 统一描述当前启用的 provider 与各 provider 的子配置。
 */
export interface UploadSystemConfig {
  provider: UploadProviderEnum
  superbedNonImageFallbackToLocal: boolean
  qiniu: UploadSystemQiniuConfig
  superbed: UploadSystemSuperbedConfig
}

/**
 * 上传配置提供器契约。
 * 动态模块通过该接口向上传服务暴露最终生效配置。
 */
export interface UploadConfigProvider {
  getUploadConfig: () => UploadSystemConfig
}

/**
 * 上传模块动态注册选项。
 */
export interface UploadModuleOptions {
  imports?: Array<DynamicModule | Type<object>>
}

/**
 * multipart 表单字段的最小读取结构。
 */
export interface MultipartFieldLike {
  type?: string
  value?: string | number
}

/**
 * 外部上传 SDK 响应错误消息的最小结构。
 */
export interface UploadResponseCarrier {
  response?: {
    message?: string | string[]
  }
}

/**
 * Superbed 原生传输失败的最小诊断结构。
 * 用于替代 AxiosError 后保留 HTTP 状态、状态文案和安全响应摘要。
 */
export interface SuperbedNativeTransportError extends Error {
  /** 原生传输或本地 helper 生成的错误码。 */
  code?: string
  /** 第三方 HTTP 响应状态码。 */
  httpStatus?: number
  /** 已脱敏前的第三方响应原始摘要，消费方必须再次走脱敏管道。 */
  responseData?: unknown
  /** 第三方 HTTP 响应状态文案。 */
  statusText?: string
}

/**
 * Superbed 原生 POST 请求体。
 * multipart 上传与 JSON 删除共用同一个 fetch helper。
 */
export type SuperbedPostBody = FormData | Record<string, unknown>

/**
 * Superbed 原生 POST 请求选项。
 */
export interface SuperbedPostOptions {
  /** 请求超时时间；不传时不主动创建 AbortSignal。 */
  timeoutMs?: number
}

/**
 * Superbed 响应 JSON 读取选项。
 */
export interface SuperbedReadResponseOptions {
  /** 非 2xx 响应允许不是 JSON，以便优先保留 HTTP 诊断。 */
  allowInvalidJson?: boolean
}

/**
 * 上传文件大类。
 * 用于场景校验、对象 key 规划和 provider 兼容处理。
 */
export type UploadFileCategory =
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'
  | 'package'

/**
 * 已完成校验和对象 key 规划的待上传文件。
 */
export interface PreparedUploadFile {
  tempPath: string
  objectKey: string
  finalName: string
  originalName: string
  mimeType: string
  ext: string
  fileCategory: UploadFileCategory
  scene: string
  fileSize: number
  width?: number
  height?: number
}

/**
 * provider 选择钩子的上下文。
 * 调用方只能基于已完成校验的文件与系统配置选择 provider，不接触底层流或临时文件生命周期。
 */
export interface UploadProviderResolutionContext {
  file: PreparedUploadFile
  systemConfig: UploadSystemConfig
  configuredProvider: UploadProviderEnum
  defaultProvider: UploadProviderEnum
}

/**
 * 单次上传的通用策略选项。
 * 默认不传时保持公共上传入口的既有 provider、scene 和分类语义。
 */
export interface UploadFileOptions {
  sceneOverride?: string
  allowedFileCategories?: readonly UploadFileCategory[]
  resolveProvider?: (
    context: UploadProviderResolutionContext,
  ) => UploadProviderEnum | undefined
}

/**
 * 规范化后的存储文件名与可选图片尺寸。
 */
export interface StoredUploadNameResult {
  finalName: string
  width?: number
  height?: number
}

/**
 * provider 执行上传后的最小结果。
 */
export interface UploadExecutionResult {
  filePath: string
  deleteTarget: UploadDeleteTarget
}

/**
 * 本地文件二次上传参数。
 * 用于压缩包解压后的文件继续复用统一上传 provider 流程。
 */
export interface UploadLocalFileOptions {
  localPath: string
  objectKeySegments: string[]
  originalName?: string
  finalName?: string
}

/**
 * 已上传文件的删除句柄。
 * 后台补偿逻辑直接依赖该句柄，不再通过公开 URL 反推 provider 或对象位置。
 */
export interface UploadDeleteTarget {
  provider: UploadProviderEnum
  filePath: string
  objectKey?: string
}

/**
 * 内部上传结果。
 * 统一返回对外展示字段与后台补偿所需的删除句柄。
 */
export interface UploadStoredFileResult {
  upload: UploadResult
  deleteTarget: UploadDeleteTarget
}

/**
 * 上传结果。
 * - 用于 service 返回文件上传后的稳定元数据
 */
export interface UploadResult {
  filename: string
  originalName: string
  filePath: string
  fileSize: number
  mimeType: string
  fileType: string
  fileCategory: UploadFileCategory
  scene: string
  width?: number
  height?: number
  uploadTime: Date
}
