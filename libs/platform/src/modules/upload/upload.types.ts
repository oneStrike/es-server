import type { DynamicModule, Type } from '@nestjs/common'

export const UPLOAD_CONFIG_PROVIDER = 'UPLOAD_CONFIG_PROVIDER'

export enum UploadProviderEnum {
  LOCAL = 'local',
  QINIU = 'qiniu',
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
  imports?: Array<DynamicModule | Type<any>>
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
}

export interface UploadExecutionResult {
  filePath: string
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
  scene: string
  uploadTime: Date
}
