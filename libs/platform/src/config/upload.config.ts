import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { parseBytes } from '@libs/platform/utils';
import { registerAs } from '@nestjs/config'
import mime from 'mime-types'

export const UPLOAD_CUSTOM_MIME_BY_EXT = {
  apk: 'application/vnd.android.package-archive',
  ipa: 'application/octet-stream',
} as const

// 允许的文件扩展名配置
const allowExtensions = {
  image: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'svg',
    'apng',
    'bmp',
    'tif',
    'tiff',
    'heic',
    'heif',
  ],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'amr', '3gpp', '3gp'],
  video: ['mp4', 'mov', 'avi', 'flv', 'ogg', 'webm', '3gpp', '3gp', 'mkv'],
  document: [
    'pdf',
    'txt',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'odt',
    'ods',
    'odp',
    'csv',
  ],
  archive: ['zip', 'rar', '7z', 'gz', 'tar'],
  package: ['apk', 'ipa'],
}

const {
  UPLOAD_LOCAL_DIR = './uploads/public',
  UPLOAD_TMP_DIR = './uploads/tmp',
  UPLOAD_LOCAL_URL_PREFIX = '/files',
  UPLOAD_MAX_FILE_SIZE = '100MB',
} = process.env

// 扁平化的扩展名数组
export const allowExtensionsFlat = Object.values(allowExtensions).flat()

// 允许的MIME类型
const allowMimeTypes: Partial<typeof allowExtensions> = {}
for (const key in allowExtensions) {
  const element = allowExtensions[key]
  allowMimeTypes[key as keyof typeof allowExtensions] = element
    .map((ext) => UPLOAD_CUSTOM_MIME_BY_EXT[ext] || mime.lookup(ext))
    .filter((item) => item !== false)
}

// 允许的MIME类型数组
export const allowMimeTypesFlat = Object.values(allowMimeTypes).flat()

export const UploadConfig = {
  maxFileSize: parseBytes(UPLOAD_MAX_FILE_SIZE),
  localDir: isAbsolute(UPLOAD_LOCAL_DIR)
    ? UPLOAD_LOCAL_DIR
    : resolve(UPLOAD_LOCAL_DIR),
  tmpDir: isAbsolute(UPLOAD_TMP_DIR) ? UPLOAD_TMP_DIR : resolve(UPLOAD_TMP_DIR),
  localUrlPrefix: UPLOAD_LOCAL_URL_PREFIX,
  allowExtensions,
  allowExtensionsFlat,
  allowMimeTypes,
  allowMimeTypesFlat,
}

export type { UploadConfigInterface } from './upload.types'
/**
 * 注册上传配置
 */ // 注册上传配置
export const UploadConfigRegister = registerAs('upload', () => UploadConfig)
