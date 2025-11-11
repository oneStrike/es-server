import type { UploadConfig } from '@/config/upload.config'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { extname } from 'node:path'
import { Transform } from 'node:stream'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 文件流处理服务
 * 负责处理文件流的创建、大小监控、哈希计算等功能
 */
@Injectable()
export class UploadStreamService {
  /**
   * 创建文件处理流（包含大小监控和哈希计算）
   * @param config 上传配置
   * @param filename 文件名
   * @returns 转换流和状态对象
   */
  createFileProcessingStream(config: UploadConfig, filename: string) {
    let totalSize = 0
    const hash = createHash('md5')

    const processingStream = new Transform({
      transform(chunk: any, encoding: any, callback: any) {
        totalSize += chunk.length

        // 实时检查文件大小，超过限制立即停止
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

  /**
   * 获取文件的扩展名
   * @param filename 文件名
   * @returns 扩展名（小写，包含点号）
   */
  getFileExtension(filename: string): string {
    return extname(filename).toLowerCase()
  }

  /**
   * 清理临时文件
   * @param filePath 文件路径
   * @param logger 日志服务
   * @param filename 原始文件名（用于日志）
   */
  cleanupTempFile(filePath: string, logger: any): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger?.warn(`已删除残留文件: ${filePath}`)
      }
    } catch (error) {
      logger?.error(`删除文件时出错: ${error.message}`, error.stack)
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 是否存在
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath)
  }

  /**
   * 重命名文件
   * @param oldPath 旧路径
   * @param newPath 新路径
   */
  renameFile(oldPath: string, newPath: string): void {
    fs.renameSync(oldPath, newPath)
  }

  /**
   * 创建写入流
   * @param filePath 文件路径
   * @returns 写入流
   */
  createWriteStream(filePath: string) {
    return fs.createWriteStream(filePath)
  }
}
