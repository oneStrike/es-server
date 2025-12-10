import type { UploadConfigInterface } from '@libs/base/config'
import type { FastifyRequest } from 'fastify'
import { join } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { UploadResponseDto } from '@libs/base/dto'
import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { fileTypeStream } from 'file-type'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'

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
   * 生成文件保存路径
   * @param uploadPath 基础上传路径
   * @param fileType 文件类型分类
   * @param scene 场景名称
   * @returns 完整的文件保存路径
   */
  generateFilePath(uploadPath: string, fileType: string, scene: string) {
    // 参数验证
    if (!uploadPath || !fileType) {
      throw new Error('上传失败')
    }

    // 使用现代日期处理方式生成日期字符串
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const savePath = join(uploadPath, dateStr, fileType, scene)
    fs.ensureDirSync(savePath, 0o755)
    // 安全地拼接路径
    return savePath
  }

  /**
   * 根据文件扩展名获取文件类型
   * @param ext 文件扩展名（带点）
   * @returns 文件类型分类（如image、audio等）
   */
  getFileTypeFromExt(ext: string) {
    ext = ext.toLowerCase() // 转换为小写
    for (const type in this.uploadConfig.allowExtensions) {
      if (this.uploadConfig.allowExtensions[type].includes(ext)) {
        return type
      }
    }
  }

  /**
   * 消费流并等待结束，防止连接重置
   */
  private async consumeStream(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve) => {
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })
  }

  /**
   * 上传单个文件
   * @param data Fastify multipart数据
   * @returns 上传结果
   */
  async uploadFile(data: FastifyRequest): Promise<UploadResponseDto> {
    const targetFile = await data.file()
    if (!targetFile) {
      throw new BadRequestException('上传文件不能为空')
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
      // 必须消费完文件流，否则会导致客户端连接重置 (ERR_CONNECTION_RESET)
      await this.consumeStream(targetFile.file)
      throw new BadRequestException('未知的上传场景')
    }

    // 使用fileTypeStream函数检测文件类型，返回一个带有fileType属性的流
    const detectionStream = await fileTypeStream(targetFile.file)
    // 从流的fileType属性中获取文件类型信息
    const { ext, mime } = detectionStream.fileType || {}
    if (!ext || !mime) {
      await this.consumeStream(detectionStream)
      throw new BadRequestException('无法识别的文件类型')
    }

    if (!this.uploadConfig.allowMimeTypesFlat?.includes(mime)) {
      await this.consumeStream(detectionStream)
      throw new BadRequestException('不被允许的文件类型')
    }

    // 生成保存路径
    const fileType = this.getFileTypeFromExt(ext)
    if (!fileType) {
      await this.consumeStream(detectionStream)
      throw new BadRequestException('未知的文件类型')
    }
    const savePath = this.generateFilePath(
      this.uploadConfig.uploadDir,
      fileType,
      scene,
    )
    // 生成文件名（保留原扩展，规范化小写）
    const tempName = `.${uuidv4()}.uploading`
    const tempPath = join(savePath, tempName)
    const writeStream = fs.createWriteStream(tempPath)
    try {
      // 使用管道流式处理文件，使用detectionStream而不是targetFile.file
      await pump(detectionStream, writeStream)
      if (targetFile.file.truncated) {
        throw new PayloadTooLargeException('文件大小超过限制')
      }
      // 生成最终文件名并重命名临时文件
      const finalName = `${uuidv4()}.${ext}`
      const finalPath = join(savePath, finalName)
      fs.renameSync(tempPath, finalPath)
      const relativePath = finalPath
        .replace(this.uploadConfig.uploadDir, '')
        .replace(/\\/g, '/')

      return {
        filename: finalName,
        originalName: targetFile.filename,
        filePath: `${this.fileUrlPrefix}${relativePath}`,
        fileSize: fs.statSync(finalPath).size,
        mimeType: mime,
        fileType: ext,
        scene,
        uploadTime: new Date(),
      }
    } catch (error) {
      fs.removeSync(tempPath)
      if (error.response.message) {
        throw error
      }
      throw new BadRequestException('上传文件失败')
    }
  }
}
