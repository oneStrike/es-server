import type { FastifyRequest } from 'fastify'
import type { UploadConfig } from '@/config/upload.config'

import { join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v4 as uuidv4 } from 'uuid'
import { UploadResponseDto } from '@/common/dto/upload.dto'
import { UploadPathService } from './upload-path.service'
import { UploadSignatureService } from './upload-signature.service'
import { UploadStreamService } from './upload-stream.service'
import { UploadValidatorService } from './upload-validator.service'

const pump = promisify(pipeline)

/**
 * 文件上传服务 - 重构版本
 * 主要负责协调各个子服务，完成文件上传的核心业务流程
 */
@Injectable()
export class UploadService {
  private uploadPath: string

  private uploadConfig: UploadConfig | null = null

  // 注入子服务
  private readonly validator: UploadValidatorService
  private readonly streamProcessor: UploadStreamService
  private readonly signatureValidator: UploadSignatureService
  private readonly pathManager: UploadPathService

  constructor(
    private configService: ConfigService,
    // 注入子服务
    validator: UploadValidatorService,
    streamProcessor: UploadStreamService,
    signatureValidator: UploadSignatureService,
    pathManager: UploadPathService,
  ) {
    this.uploadPath = this.getUploadConfig().uploadDir

    // 初始化子服务
    this.validator = validator
    this.streamProcessor = streamProcessor
    this.signatureValidator = signatureValidator
    this.pathManager = pathManager
  }

  private getUploadConfig(): UploadConfig {
    // 缓存配置以避免重复获取
    if (!this.uploadConfig) {
      this.uploadConfig = this.configService.get<UploadConfig>('upload')!
    }
    return this.uploadConfig
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
    const config = this.getUploadConfig()
    const files = data.files()
    const filePromises: Promise<UploadResponseDto | null>[] = []
    const errors: Error[] = []

    scene = this.pathManager.sanitizeScene(scene)

    // 收集所有文件处理任务
    for await (const file of files) {
      // 内联文件处理逻辑以提高性能
      const filePromise = this.processSingleFile(file, config, scene)
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
      throw errors[0]
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
   * @param config 上传配置
   * @param scene 场景
   * @returns 上传结果
   */
  private async processSingleFile(
    file: any,
    config: UploadConfig,
    scene: string,
  ): Promise<UploadResponseDto | null> {
    const startTime = Date.now()

    try {
      // 验证文件
      this.validator.validateFile(file, config)

      // 获取文件类型分类
      const fileType = this.validator.getFileTypeCategory(file.mimetype, config)

      // 生成保存路径
      const savePath = this.pathManager.generateFilePath(
        this.uploadPath,
        fileType,
        scene,
      )
      this.pathManager.ensureUploadDirectory(savePath)

      // 生成文件名（保留原扩展，规范化小写）
      const ext = this.streamProcessor.getFileExtension(file.filename)
      const tempName = `.${uuidv4()}.uploading`
      const tempPath = join(savePath, tempName)
      const writeStream = this.streamProcessor.createWriteStream(tempPath)

      // 创建文件处理流
      const {
        stream: processingStream,
        getSize,
        getHash,
      } = this.streamProcessor.createFileProcessingStream(config, file.filename)

      // 签名校验流（防伪造 Content-Type）
      const signatureStream =
        this.signatureValidator.createSignatureCheckStream(
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
          this.streamProcessor.cleanupTempFile(tempPath, null)
          throw new BadRequestException(
            `文件 ${file.filename} 超出大小限制 ${config.maxFileSize} 字节`,
          )
        }

        const processingTime = Date.now() - startTime
        const fileSize = getSize()
        const fileHash = getHash()

        // 二次验证文件大小（防止流处理过程中的边界情况）
        this.validator.validateFileSize(
          fileSize,
          config.maxFileSize,
          file.filename,
        )

        // 生成最终文件名并重命名临时文件
        let finalName = this.pathManager.generateFinalFilename(
          file.filename,
          ext,
          config.filenameStrategy,
          fileHash,
        )
        let finalPath = join(savePath, finalName)
        try {
          // 若发生同名冲突（如重复上传同 hash），添加短 uuid 后缀
          if (this.streamProcessor.fileExists(finalPath)) {
            const altName = `${finalName.replace(ext, '')}-${uuidv4().slice(0, 6)}${ext}`
            const altPath = join(savePath, altName)
            this.streamProcessor.renameFile(tempPath, altPath)
            console.warn(`目标文件已存在，已改名为: ${altName}`)
            finalName = altName
            finalPath = altPath
          } else {
            this.streamProcessor.renameFile(tempPath, finalPath)
          }
        } catch (renameError: any) {
          // 重命名失败则清理临时文件并抛出错误
          this.streamProcessor.cleanupTempFile(tempPath, null)
          throw renameError
        }

        console.log(
          `文件上传成功: ${file.filename} -> ${finalName} (${fileSize} bytes, ${processingTime}ms, hash: ${fileHash})`,
        )
        // 计算公开路径（相对于 uploads 静态前缀）
        const filePath = this.pathManager.toPublicPath(
          finalPath,
          this.uploadPath,
        )

        return {
          filename: finalName,
          originalName: this.pathManager.sanitizeOriginalName(file.filename),
          filePath,
          fileSize,
          mimeType: file.mimetype,
          fileType,
          scene,
          uploadTime: new Date(),
        }
      } catch (error) {
        // 如果上传失败，尝试删除已创建的文件
        this.streamProcessor.cleanupTempFile(tempPath, null)
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
