import type { UploadConfig } from '@/config/upload.config'
import { extname } from 'node:path'
import { BadRequestException, Injectable } from '@nestjs/common'

/**
 * 文件验证服务
 * 负责处理所有文件相关的验证逻辑，包括MIME类型、扩展名、文件大小等
 */
@Injectable()
export class UploadValidatorService {
  private mimeTypeMap: Map<string, string> = new Map()

  /**
   * 初始化MIME类型映射表（性能优化：避免重复数组查找）
   */
  private initializeMimeTypeMap(config: UploadConfig): void {
    if (this.mimeTypeMap.size > 0) {
      return // 已经初始化过了
    }

    const typeCategories = [
      { category: 'image', types: config.imageType.mimeTypes },
      { category: 'audio', types: config.audioType.mimeTypes },
      { category: 'video', types: config.videoType.mimeTypes },
      { category: 'document', types: config.documentType.mimeTypes },
      { category: 'archive', types: config.archiveType.mimeTypes },
    ]

    typeCategories.forEach(({ category, types }) => {
      types.forEach((mimeType) => {
        this.mimeTypeMap.set(mimeType, category)
      })
    })
  }

  /**
   * 根据MIME类型获取文件类型分类（性能优化：使用Map查找）
   * @param mimeType MIME类型
   * @param config 上传配置
   * @returns 文件类型分类
   */
  getFileTypeCategory(mimeType: string, config: UploadConfig): string {
    // 确保MIME类型映射表已初始化
    this.initializeMimeTypeMap(config)
    return this.mimeTypeMap.get(mimeType) || 'other'
  }

  /**
   * 验证文件类型和大小
   * @param file 文件对象
   * @param config 上传配置
   */
  validateFile(file: any, config: UploadConfig): void {
    // 验证MIME类型
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `文件 ${file.filename} 类型不支持: ${file.mimetype}`,
      )
    }

    // 验证文件扩展名
    const ext = this.getFileExtension(file.filename)
    if (!config.allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `文件 ${file.filename} 扩展名不支持: ${ext}`,
      )
    }

    // 扩展名与MIME类型一致性检查（按类别）
    const category = this.getFileTypeCategory(file.mimetype, config)
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

    // 验证文件大小（注意：在流式处理中，我们需要在处理过程中检查大小）
    // 这里我们先做一个基本检查，实际大小检查在流处理中进行
  }

  /**
   * 获取文件扩展名（小写）
   * @param filename 文件名
   * @returns 扩展名（包含点号）
   */
  private getFileExtension(filename: string): string {
    return extname(filename).toLowerCase()
  }

  /**
   * 验证文件大小是否超限
   * @param fileSize 文件大小
   * @param maxSize 最大允许大小
   * @param filename 文件名
   */
  validateFileSize(fileSize: number, maxSize: number, filename: string): void {
    if (fileSize > maxSize) {
      throw new BadRequestException(
        `文件 ${filename} 大小 ${fileSize} 字节超出限制 ${maxSize} 字节`,
      )
    }
  }
}
