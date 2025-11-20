import type { UploadConfig } from '@/config/upload.config'
import { extname } from 'node:path'
import { BadRequestException } from '@nestjs/common'

const mimeTypeMap: Map<string, string> = new Map()

function initMimeTypeMap(config: UploadConfig): void {
  if (mimeTypeMap.size > 0)
{ return }
  const typeCategories = [
    { category: 'image', types: config.imageType.mimeTypes },
    { category: 'audio', types: config.audioType.mimeTypes },
    { category: 'video', types: config.videoType.mimeTypes },
    { category: 'document', types: config.documentType.mimeTypes },
    { category: 'archive', types: config.archiveType.mimeTypes },
  ]
  typeCategories.forEach(({ category, types }) => {
    types.forEach((t) => mimeTypeMap.set(t, category))
  })
}

export function getFileTypeCategory(mimeType: string, config: UploadConfig): string {
  initMimeTypeMap(config)
  return mimeTypeMap.get(mimeType) || 'other'
}

export function validateFile(file: any, config: UploadConfig): void {
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(`文件 ${file.filename} 类型不支持: ${file.mimetype}`)
  }
  const ext = extname(file.filename).toLowerCase()
  if (!config.allowedExtensions.includes(ext)) {
    throw new BadRequestException(`文件 ${file.filename} 扩展名不支持: ${ext}`)
  }
  const category = getFileTypeCategory(file.mimetype, config)
  const categoryExtsMap: Record<string, string[]> = {
    image: config.imageType.extensions,
    audio: config.audioType.extensions,
    video: config.videoType.extensions,
    document: config.documentType.extensions,
    archive: config.archiveType.extensions,
    other: [],
  }
  const exts = categoryExtsMap[category] || []
  if (exts.length > 0 && !exts.includes(ext)) {
    throw new BadRequestException(
      `文件扩展名与类型不匹配: ${file.mimetype} 不应为 ${ext}`,
    )
  }
}

export function validateFileSize(fileSize: number, maxSize: number, filename: string): void {
  if (fileSize > maxSize) {
    throw new BadRequestException(
      `文件 ${filename} 大小 ${fileSize} 字节超出限制 ${maxSize} 字节`,
    )
  }
}
