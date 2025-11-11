import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

/**
 * 文件上传配置
 */
interface fileTypeConfig {
  mimeTypes: string[]
  extensions: string[]
}
export interface UploadConfig {
  /** 最大文件大小 (字节) */
  maxFileSize: number
  /** 最大文件数量 */
  maxFiles: number
  /** 允许的文件类型 */
  allowedMimeTypes: string[]
  /** 允许的文件扩展名 */
  allowedExtensions: string[]
  imageType: fileTypeConfig
  audioType: fileTypeConfig
  videoType: fileTypeConfig
  documentType: fileTypeConfig
  archiveType: fileTypeConfig
  /** 上传目录 */
  uploadDir: string
  /** 是否保留原始文件名 */
  preserveOriginalName: boolean
  /** 文件名生成策略：uuid | uuid_original | hash | hash_original */
  filenameStrategy: 'uuid' | 'uuid_original' | 'hash' | 'hash_original'
}

/**
 * 允许的文件类型
 */

export const imageType = {
  mimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/apng',
    'image/bmp',
    'image/x-bmp',
    'image/tiff',
    'image/heic',
    'image/heif',
  ],
  extensions: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.apng',
    '.bmp',
    '.tif',
    '.tiff',
    '.heic',
    '.heif',
  ],
}
// 音频类型
export const audioType = {
  mimeTypes: [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/flac',
    'audio/aac',
    'audio/x-m4a',
    'audio/amr',
    'audio/3gpp',
  ],
  extensions: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.amr', '.3gp'],
}

// 视频类型
export const videoType = {
  mimeTypes: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-flv',
    'video/ogg',
    'video/webm',
    'video/3gpp',
    'video/x-matroska',
  ],
  extensions: ['.mp4', '.mov', '.avi', '.flv', '.ogv', '.webm', '.3gp', '.mkv'],
}

// 文档类型
export const documentType = {
  mimeTypes: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'text/csv',
  ],
  extensions: [
    '.pdf',
    '.txt',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.odt',
    '.ods',
    '.odp',
    '.csv',
  ],
}

// 压缩包类型
export const archiveType = {
  mimeTypes: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
  ],
  extensions: ['.zip', '.rar', '.7z', '.gz', '.tar'],
}

/**
 * 文件类型配置处理器 - 消除重复代码
 */
type fileTypeConfigs = Record<
  string,
  {
    defaultType: fileTypeConfig
    mimeEnvKey: string
    extEnvKey: string
  }
>
class FileTypeConfigProcessor {
  private static readonly FILE_TYPE_CONFIGS: fileTypeConfigs = {
    image: {
      defaultType: imageType,
      mimeEnvKey: 'UPLOAD_IMAGE_MIME_TYPES',
      extEnvKey: 'UPLOAD_IMAGE_EXTENSIONS',
    },
    audio: {
      defaultType: audioType,
      mimeEnvKey: 'UPLOAD_AUDIO_MIME_TYPES',
      extEnvKey: 'UPLOAD_AUDIO_EXTENSIONS',
    },
    video: {
      defaultType: videoType,
      mimeEnvKey: 'UPLOAD_VIDEO_MIME_TYPES',
      extEnvKey: 'UPLOAD_VIDEO_EXTENSIONS',
    },
    document: {
      defaultType: documentType,
      mimeEnvKey: 'UPLOAD_DOCUMENT_MIME_TYPES',
      extEnvKey: 'UPLOAD_DOCUMENT_EXTENSIONS',
    },
    archive: {
      defaultType: archiveType,
      mimeEnvKey: 'UPLOAD_ARCHIVE_MIME_TYPES',
      extEnvKey: 'UPLOAD_ARCHIVE_EXTENSIONS',
    },
  }

  /**
   * 处理单个文件类型的配置
   */
  private static processFileTypeConfig(typeName: string): fileTypeConfig {
    const config = FileTypeConfigProcessor.FILE_TYPE_CONFIGS[typeName]

    // 处理MIME类型配置
    const mimeEnvValue = process.env[config.mimeEnvKey]
    const mimeTypes = mimeEnvValue
      ? mimeEnvValue
          .split(',')
          .map((mt) => mt.trim())
          .filter((mt) => mt)
      : [...config.defaultType.mimeTypes]

    // 处理扩展名配置
    const extEnvValue = process.env[config.extEnvKey]
    const extensions = extEnvValue
      ? extEnvValue
          .split(',')
          .map((ext) => ext.trim().toLowerCase())
          .filter((ext) => ext.startsWith('.') && ext.length > 1)
      : [...config.defaultType.extensions]

    return { mimeTypes, extensions }
  }

  /**
   * 处理所有文件类型配置
   */
  static processAllFileTypes() {
    const result = {
      imageType: this.processFileTypeConfig('image'),
      audioType: this.processFileTypeConfig('audio'),
      videoType: this.processFileTypeConfig('video'),
      documentType: this.processFileTypeConfig('document'),
      archiveType: this.processFileTypeConfig('archive'),
    }

    // 生成允许的MIME类型和扩展名列表
    const allowedMimeTypes = [
      ...result.imageType.mimeTypes,
      ...result.audioType.mimeTypes,
      ...result.videoType.mimeTypes,
      ...result.documentType.mimeTypes,
      ...result.archiveType.mimeTypes,
    ]

    const allowedExtensions = [
      ...result.imageType.extensions,
      ...result.audioType.extensions,
      ...result.videoType.extensions,
      ...result.documentType.extensions,
      ...result.archiveType.extensions,
    ]

    return {
      ...result,
      allowedMimeTypes,
      allowedExtensions,
    }
  }
}

/**
 * 注册上传配置
 */
export default registerAs('upload', (): UploadConfig => {
  const isDocker =
    process.cwd() === '/app' ||
    existsSync('/.dockerenv') ||
    process.env.DOCKER === 'true'

  // 使用配置处理器统一处理所有文件类型
  const fileTypeConfigs = FileTypeConfigProcessor.processAllFileTypes()

  // 获取基本配置
  const maxFileSize = (() => {
    const value = process.env.UPLOAD_MAX_FILE_SIZE
    if (value) {
      const num = Number.parseInt(value, 10)
      return Number.isNaN(num) || num <= 0 ? 100 * 1024 * 1024 : num
    }
    return 100 * 1024 * 1024
  })()

  const maxFiles = (() => {
    const value = process.env.UPLOAD_MAX_FILES
    if (value) {
      const num = Number.parseInt(value, 10)
      return Number.isNaN(num) || num <= 0 ? 50 : num
    }
    return 50
  })()

  const uploadDir = (() => {
    // 允许通过环境变量覆盖，即使在容器中
    const dirCandidate =
      process.env.UPLOAD_DIR ||
      (isDocker
        ? '/app/uploads'
        : process.env.APP_DATA_DIR
          ? join(process.env.APP_DATA_DIR, 'uploads')
          : 'uploads')

    if (process.env.UPLOAD_ABSOLUTE_PATH === 'true') {
      return dirCandidate
    }

    return isAbsolute(dirCandidate)
      ? dirCandidate
      : join(process.cwd(), dirCandidate)
  })()

  const preserveOriginalName = process.env.UPLOAD_PRESERVE_ORIGINAL_NAME
    ? ['true', '1', 'yes'].includes(
        process.env.UPLOAD_PRESERVE_ORIGINAL_NAME.toLowerCase(),
      )
    : true

  const filenameStrategy = (() => {
    const v = (process.env.UPLOAD_FILENAME_STRATEGY || 'uuid').toLowerCase()
    switch (v) {
      case 'uuid':
      case 'uuid_original':
      case 'hash':
      case 'hash_original':
        return v as any
      default:
        return 'uuid'
    }
  })()

  return {
    maxFileSize,
    maxFiles,
    imageType: {
      mimeTypes: fileTypeConfigs.imageType.mimeTypes,
      extensions: fileTypeConfigs.imageType.extensions,
    },
    audioType: {
      mimeTypes: fileTypeConfigs.audioType.mimeTypes,
      extensions: fileTypeConfigs.audioType.extensions,
    },
    videoType: {
      mimeTypes: fileTypeConfigs.videoType.mimeTypes,
      extensions: fileTypeConfigs.videoType.extensions,
    },
    documentType: {
      mimeTypes: fileTypeConfigs.documentType.mimeTypes,
      extensions: fileTypeConfigs.documentType.extensions,
    },
    archiveType: {
      mimeTypes: fileTypeConfigs.archiveType.mimeTypes,
      extensions: fileTypeConfigs.archiveType.extensions,
    },
    allowedMimeTypes: fileTypeConfigs.allowedMimeTypes,
    allowedExtensions: fileTypeConfigs.allowedExtensions,
    uploadDir,
    preserveOriginalName,
    filenameStrategy,
  }
})
