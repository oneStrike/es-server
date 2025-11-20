import type { UploadConfig } from '@/config/upload.config'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { extname } from 'node:path'
import { Transform } from 'node:stream'
import { BadRequestException } from '@nestjs/common'

export function createFileProcessingStream(config: UploadConfig, filename: string) {
  let totalSize = 0
  const hash = createHash('md5')

  const processingStream = new Transform({
    transform(chunk: any, _encoding: any, callback: any) {
      totalSize += chunk.length
      if (totalSize > config.maxFileSize) {
        const error = new BadRequestException(
          `文件 ${filename} 大小超出限制 ${config.maxFileSize} 字节`,
        )
        return callback(error)
      }
      hash.update(chunk)
      callback(null, chunk)
    },
  })

  return {
    stream: processingStream,
    getSize: () => totalSize,
    getHash: () => hash.digest('hex'),
  }
}

export function getFileExtension(filename: string): string {
  return extname(filename).toLowerCase()
}

export function cleanupTempFile(filePath: string, logger: any): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logger?.warn(`已删除残留文件: ${filePath}`)
    }
  } catch (error: any) {
    logger?.error(`删除文件时出错: ${error.message}`, error.stack)
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

export function renameFile(oldPath: string, newPath: string): void {
  fs.renameSync(oldPath, newPath)
}

export function createWriteStream(filePath: string) {
  return fs.createWriteStream(filePath)
}
