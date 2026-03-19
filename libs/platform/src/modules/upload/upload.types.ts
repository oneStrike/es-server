import type { DynamicModule, Type } from '@nestjs/common'

export const UPLOAD_CONFIG_PROVIDER = 'UPLOAD_CONFIG_PROVIDER'

export enum UploadProviderEnum {
  LOCAL = 'local',
  QINIU = 'qiniu',
  SUPERBED = 'superbed',
}

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

export interface UploadSystemSuperbedConfig {
  token: string
  categories: string
  watermark?: boolean
  compress?: boolean
  webp?: boolean
}

export interface UploadSystemConfig {
  provider: UploadProviderEnum
  superbedNonImageFallbackToLocal: boolean
  qiniu: UploadSystemQiniuConfig
  superbed: UploadSystemSuperbedConfig
}

export interface UploadConfigProvider {
  getUploadConfig: () => UploadSystemConfig
}

export interface UploadModuleOptions {
  imports?: Array<DynamicModule | Type<any>>
}

export type UploadFileCategory =
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'archive'

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
