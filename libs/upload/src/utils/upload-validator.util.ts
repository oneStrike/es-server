import type { UploadConfigInterface } from '@libs/config'
import { extname } from 'node:path'
import { BadRequestException } from '@nestjs/common'

const mimeTypeMap: Map<string, string> = new Map()

function initMimeTypeMap(config: UploadConfigInterface): void {
  if (mimeTypeMap.size > 0) {
    return
  }

  for (const allowFileKey in config.allowFile) {
    const fileTypeConfig = config.allowFile[allowFileKey]
    fileTypeConfig.mimeTypes.forEach((t) => mimeTypeMap.set(t, allowFileKey))
  }
}

export function getFileTypeCategory(
  mimeType: string,
  config: UploadConfigInterface,
) {
  initMimeTypeMap(config)
  return mimeTypeMap.get(mimeType)!
}

export function validateFile(file: any, config: UploadConfigInterface) {
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestException(
      `文件 ${file.filename} 类型不支持: ${file.mimetype}`,
    )
  }
  const ext = extname(file.filename).toLowerCase()
  if (!config.allowedExtensions.includes(ext)) {
    throw new BadRequestException(`文件 ${file.filename} 扩展名不支持: ${ext}`)
  }
  const category = getFileTypeCategory(file.mimetype, config)

  const exts = config.allowFile[category] || []
  if (exts.length > 0 && !exts.includes(ext)) {
    throw new BadRequestException(
      `文件扩展名与类型不匹配: ${file.mimetype} 不应为 ${ext}`,
    )
  }
  return { fileType: category }
}

export function validateFileSize(
  fileSize: number,
  maxSize: number,
  filename: string,
): void {
  if (fileSize > maxSize) {
    throw new BadRequestException(
      `文件 ${filename} 大小 ${fileSize} 字节超出限制 ${maxSize} 字节`,
    )
  }
}
