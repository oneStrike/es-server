import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { registerAs } from '@nestjs/config'

/**
 * 文件上传配置
 */
interface fileTypeConfig {
  mimeTypes: string[]
  extensions: string[]
}
export interface UploadConfigInterface {
  /** 最大文件大小 (字节) */
  maxFileSize: number
  /** 允许的文件类型 */
  allowedMimeTypes: string[]
  /** 允许的文件扩展名 */
  allowedExtensions: string[]
  allowFile: {
    image: fileTypeConfig
    audio: fileTypeConfig
    video: fileTypeConfig
    document: fileTypeConfig
    archive: fileTypeConfig
  }
  /** 上传目录 */
  uploadDir: string
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
 * 文件类型配置处理器
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
      allowedImageType: this.processFileTypeConfig('image'),
      allowedAudioType: this.processFileTypeConfig('audio'),
      allowedVideoType: this.processFileTypeConfig('video'),
      allowedDocumentType: this.processFileTypeConfig('document'),
      allowedArchiveType: this.processFileTypeConfig('archive'),
    }

    // 生成允许的MIME类型和扩展名列表
    const allowedMimeTypes = [
      ...result.allowedImageType.mimeTypes,
      ...result.allowedAudioType.mimeTypes,
      ...result.allowedVideoType.mimeTypes,
      ...result.allowedDocumentType.mimeTypes,
      ...result.allowedArchiveType.mimeTypes,
    ]

    const allowedExtensions = [
      ...result.allowedImageType.extensions,
      ...result.allowedAudioType.extensions,
      ...result.allowedVideoType.extensions,
      ...result.allowedDocumentType.extensions,
      ...result.allowedArchiveType.extensions,
    ]

    return {
      ...result,
      allowedMimeTypes,
      allowedExtensions,
    }
  }
}

const fileSizeMap = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
}

const {
  UPLOAD_DIR,
  UPLOAD_MAX_FILE_SIZE = '100MB',
} = process.env
// 解析上传文件大小配置
const sizeUnit = UPLOAD_MAX_FILE_SIZE.slice(-2) as keyof typeof fileSizeMap

// 使用配置处理器统一处理所有文件类型
const {
  allowedImageType,
  allowedAudioType,
  allowedVideoType,
  allowedDocumentType,
  allowedArchiveType,
  allowedMimeTypes,
  allowedExtensions,
} = FileTypeConfigProcessor.processAllFileTypes()

const maxFileSize =
  Number(UPLOAD_MAX_FILE_SIZE.slice(0, -2)) * fileSizeMap[sizeUnit]
export const UploadConfig = {
  maxFileSize,
  uploadDir: UPLOAD_DIR
    ? isAbsolute(UPLOAD_DIR)
      ? UPLOAD_DIR
      : resolve(UPLOAD_DIR)
    : undefined,
  allowFile: {
    image: {
      mimeTypes: allowedImageType.mimeTypes,
      extensions: allowedImageType.extensions,
    },
    audio: {
      mimeTypes: allowedAudioType.mimeTypes,
      extensions: allowedAudioType.extensions,
    },
    video: {
      mimeTypes: allowedVideoType.mimeTypes,
      extensions: allowedVideoType.extensions,
    },
    document: {
      mimeTypes: allowedDocumentType.mimeTypes,
      extensions: allowedDocumentType.extensions,
    },
    archive: {
      mimeTypes: allowedArchiveType.mimeTypes,
      extensions: allowedArchiveType.extensions,
    },
  },
  allowedMimeTypes,
  allowedExtensions,
}
/**
 * 注册上传配置
 */
export const UploadConfigRegister = registerAs('upload', () => UploadConfig)
