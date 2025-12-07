import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { parseBytes } from '@libs/base/utils'
import { registerAs } from '@nestjs/config'
import mime from 'mime-types'

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
}

const { UPLOAD_DIR = './uploads', UPLOAD_MAX_FILE_SIZE = '100MB' } = process.env

// 扁平化的扩展名数组
export const allowExtensionsFlat = Object.values(allowExtensions).flat()

// 允许的MIME类型
const allowMimeTypes: Partial<typeof allowExtensions> = {}
for (const key in allowExtensions) {
  const element = allowExtensions[key]
  allowMimeTypes[key as keyof typeof allowExtensions] = element
    .map((ext) => mime.lookup(ext))
    .filter((item) => item !== false)
}

// 允许的MIME类型数组
export const allowMimeTypesFlat = Object.values(allowMimeTypes).flat()

export const UploadConfig = {
  maxFileSize: parseBytes(UPLOAD_MAX_FILE_SIZE),
  uploadDir: UPLOAD_DIR
    ? isAbsolute(UPLOAD_DIR)
      ? UPLOAD_DIR
      : resolve(UPLOAD_DIR)
    : undefined,
  allowExtensions,
  allowExtensionsFlat,
  allowMimeTypes,
  allowMimeTypesFlat,
}

export type UploadConfigInterface = typeof UploadConfig
/**
 * 注册上传配置
 */ // 注册上传配置
export const UploadConfigRegister = registerAs('upload', () => UploadConfig)
