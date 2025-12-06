import type { UploadConfigInterface } from '@libs/base/config'
import type { FastifyRequest } from 'fastify'
import { join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UploadResponseDto } from '@libs/base/dto'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
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
import { validateFile } from './utils/upload-validator.util'

const pump = promisify(pipeline)

/**
 * 文件上传服务 - 单文件模式重构版本
 * 主要负责单个文件上传的完整流程
 */
@Injectable()
export class UploadService {
  private readonly uploadConfig: UploadConfigInterface
  private readonly fileUrlPrefix: string

  constructor(@Inject(ConfigService) private configService: ConfigService) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
    this.fileUrlPrefix = this.configService.get('app.fileUrlPrefix')!
  }

  /**
   * 上传单个文件
   * @param data Fastify multipart数据
   * @returns 上传结果
   */
  async uploadFile(data: FastifyRequest): Promise<UploadResponseDto> {
    const targetFile = await data.file()
    if (!targetFile) {
      throw new BadRequestException('没有有效的文件被上传')
    }

    // 获取场景值，处理字段类型
    let scene: string | undefined
    const sceneField = targetFile.fields.scene
    if (sceneField) {
      // 如果是单个字段
      if (typeof sceneField === 'object' && 'type' in sceneField) {
        if (sceneField.type === 'field') {
          scene = String(sceneField.value)
        }
      } else if (Array.isArray(sceneField)) {
        // 如果是数组，取第一个值
        const firstField = sceneField[0]
        if (firstField.type === 'field') {
          scene = String(firstField.value)
        }
      }
    }

    if (!scene || !/^[a-z0-9]+$/i.test(scene) || scene.length > 10) {
      throw new BadRequestException('未知的上传场景')
    }

    // 验证文件
    const { fileType } = validateFile(targetFile, this.uploadConfig)

    // 生成保存路径
    const savePath = generateFilePath(
      this.uploadConfig.uploadDir,
      fileType,
      scene,
    )
    // 生成文件名（保留原扩展，规范化小写）
    const ext = getFileExtension(targetFile.filename)
    const tempName = `.${uuidv4()}.uploading`
    const tempPath = join(savePath, tempName)
    const writeStream = createWriteStream(tempPath)

    // 创建文件处理流
    const { stream: processingStream, getSize } = createFileProcessingStream(
      this.uploadConfig,
      targetFile.filename,
    )

    // 签名校验流（防伪造 Content-Type）
    const signatureStream = createSignatureCheckStream(
      targetFile.mimetype,
      ext,
      targetFile.filename,
    )

    try {
      // 使用管道流式处理文件
      await pump(
        targetFile.file,
        signatureStream,
        processingStream,
        writeStream,
      )

      // // 检查文件是否被截断（超出大小限制）
      // if (targetFile.file.truncated) {
      //   // 删除已写入的部分文件
      //   cleanupTempFile(tempPath, null)
      //   throw new BadRequestException(
      //     `文件 ${targetFile.filename} 超出大小限制 ${this.uploadConfig.maxFileSize} 字节`,
      //   )
      // }

      const fileSize = getSize()
      // 二次验证文件大小（防止流处理过程中的边界情况）
      // validateFileSize(
      //   fileSize,
      //   this.uploadConfig.maxFileSize,
      //   targetFile.filename,
      // )

      // 恶意文件检测预留扩展点
      await this.detectMaliciousFile(tempPath, targetFile)

      // 生成最终文件名并重命名临时文件
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
        originalName: sanitizeOriginalName(targetFile.filename),
        filePath: `${this.fileUrlPrefix}${finalPath}`,
        fileSize,
        mimeType: targetFile.mimetype,
        fileType,
        scene,
        uploadTime: new Date(),
      }
    } catch (error) {
      // 如果上传失败，尝试删除已创建的文件
      cleanupTempFile(tempPath, null)
      console.error(
        `文件上传失败: ${targetFile.filename} - ${error.message}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 恶意文件检测（预留扩展点）
   * 可集成第三方病毒扫描接口
   * @param _filePath 文件路径
   * @param _file 文件对象
   */
  private async detectMaliciousFile(
    _filePath: string,
    _file: any,
  ): Promise<void> {
    // TODO: 集成恶意文件检测接口
    // 目前为预留扩展点，后续可添加具体实现
    // 例如：调用ClamAV、Virustotal等第三方API
    return Promise.resolve()
  }
}
