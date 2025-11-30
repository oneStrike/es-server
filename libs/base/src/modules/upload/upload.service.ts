import type { UploadConfigInterface } from '@libs/base/config'
import type { FastifyRequest } from 'fastify'
import { join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UploadResponseDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v4 as uuidv4 } from 'uuid'
import {
  generateFilePath,
  sanitizeOriginalName,
} from './utils/upload-path.util'
import { createSignatureCheckStream } from './utils/upload-signature.util'
import {
  cleanupTempFile,
  createFileProcessingStream,
  createWriteStream,
  getFileExtension,
  renameFile,
} from './utils/upload-stream.util'
import { validateFile, validateFileSize } from './utils/upload-validator.util'

const pump = promisify(pipeline)

/**
 * 文件上传服务 - 重构版本
 * 主要负责协调各个子服务，完成文件上传的核心业务流程
 */
@Injectable()
export class UploadService {
  private readonly uploadConfig: UploadConfigInterface
  private readonly fileUrlPrefix: string

  constructor(private configService: ConfigService) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
    this.fileUrlPrefix = this.configService.get('app.fileUrlPrefix')!
  }

  /**
   * 上传多个文件（性能优化：并行处理，内联文件处理逻辑）
   * @param data Fastify multipart数据
   * @param scene 场景
   * @returns 上传结果数组
   */
  async uploadMultipleFiles(
    data: FastifyRequest,
    scene?: string,
  ): Promise<UploadResponseDto[]> {
    const files = data.files()
    const filePromises: Promise<UploadResponseDto | null>[] = []
    const errors: Error[] = []

    if (!scene || !/^[a-z0-9]+$/i.test(scene) || scene.length > 10) {
      throw new BadRequestException('未知的上传场景')
    }

    // 收集所有文件处理任务
    for await (const file of files) {
      // 内联文件处理逻辑以提高性能
      const filePromise = this.processSingleFile(file, scene)
      filePromises.push(filePromise)
    }

    if (filePromises.length === 0) {
      throw new BadRequestException('没有有效的文件被上传')
    }

    // 并行处理所有文件
    const results = await Promise.all(filePromises)

    // 过滤掉失败的文件
    const successResults = results.filter((result) => result != null)

    // 如果有错误且没有成功的文件，抛出第一个错误
    if (errors.length > 0 && successResults.length === 0) {
      throw new BadRequestException('文件上传失败')
    }

    // 如果有部分失败，记录警告
    if (errors.length > 0) {
      console.warn(
        `${errors.length} 个文件上传失败，${successResults.length} 个文件上传成功`,
      )
    }

    return successResults
  }

  /**
   * 处理单个文件的完整流程
   * @param file 文件对象
   * @param scene 场景
   * @returns 上传结果
   */
  private async processSingleFile(
    file: any,
    scene: string,
  ): Promise<UploadResponseDto | null> {
    try {
      // 验证文件
      const { fileType } = validateFile(file, this.uploadConfig)

      // 生成保存路径
      const savePath = generateFilePath(
        this.uploadConfig.uploadDir,
        fileType,
        scene,
      )
      // 生成文件名（保留原扩展，规范化小写）
      const ext = getFileExtension(file.filename)
      const tempName = `.${uuidv4()}.uploading`
      const tempPath = join(savePath, tempName)
      const writeStream = createWriteStream(tempPath)

      // 创建文件处理流
      const { stream: processingStream, getSize } = createFileProcessingStream(
        this.uploadConfig,
        file.filename,
      )

      // 签名校验流（防伪造 Content-Type）
      const signatureStream = createSignatureCheckStream(
        file.mimetype,
        ext,
        file.filename,
      )

      try {
        // 使用管道流式处理文件
        await pump(file.file, signatureStream, processingStream, writeStream)

        // 检查文件是否被截断（超出大小限制）
        if (file.file.truncated) {
          // 删除已写入的部分文件
          cleanupTempFile(tempPath, null)
          throw new BadRequestException(
            `文件 ${file.filename} 超出大小限制 ${this.uploadConfig.maxFileSize} 字节`,
          )
        }

        const fileSize = getSize()
        // 二次验证文件大小（防止流处理过程中的边界情况）
        validateFileSize(fileSize, this.uploadConfig.maxFileSize, file.filename)

        // 生成最终文件名并重命名临时文件 - 固定使用uuid策略
        const finalName = `${uuidv4()}${ext}`
        const finalPath = join(savePath, finalName)
        try {
          renameFile(tempPath, finalPath)
        } catch (renameError: any) {
          // 重命名失败则清理临时文件并抛出错误
          cleanupTempFile(tempPath, null)
          throw renameError
        }

        return {
          filename: finalName,
          originalName: sanitizeOriginalName(file.filename),
          filePath: `${this.fileUrlPrefix}${finalPath}`,
          fileSize,
          mimeType: file.mimetype,
          fileType,
          scene,
          uploadTime: new Date(),
        }
      } catch (error) {
        // 如果上传失败，尝试删除已创建的文件
        cleanupTempFile(tempPath, null)
        throw error
      }
    } catch (error) {
      console.error(
        `文件上传失败: ${file.filename} - ${error.message}`,
        error.stack,
      )
      throw error
    }
  }
}
